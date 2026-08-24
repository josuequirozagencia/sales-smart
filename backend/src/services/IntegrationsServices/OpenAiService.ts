import { MessageUpsertType, proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import { isNil } from "lodash";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI, Part, Content } from "@google/generative-ai";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import logger from "../../utils/logger";
import { getWbot } from "../../libs/wbot";
import { getJidOf } from "../WbotServices/getJidOf";

type Session = WASocket & {
  id?: number;
};

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  provider?: "openai" | "gemini";
  
  // Campos para controle de fluxo
  flowMode?: "permanent" | "temporary";
  maxInteractions?: number;
  continueKeywords?: string[];
  completionTimeout?: number;
  objective?: string;
  autoCompleteOnObjective?: boolean;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}

interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

// Função para detectar solicitação de transferência para atendente
const detectTransferRequest = (message: string): boolean => {
  const transferKeywords = [
    'falar com atendente',
    'quero um atendente', 
    'atendente humano',
    'pessoa real',
    'sair do bot',
    'parar bot',
    'atendimento humano',
    'falar com alguém',
    'não estou conseguindo',
    'isso não funciona',
    'não entendi',
    'preciso de ajuda real',
    'quero falar com uma pessoa',
    'me transfere',
    'atendente por favor'
  ];

  const lowerMessage = message.toLowerCase();
  return transferKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Função para detectar solicitação de continuação do fluxo
const detectFlowContinuation = (message: string, continueKeywords: string[]): boolean => {
  if (!continueKeywords || continueKeywords.length === 0) {
    return false;
  }
  
  const lowerMessage = message.toLowerCase().trim();
  return continueKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
};

// Função para detectar se o objetivo foi completado (usando IA)
// Funciona com qualquer provedor configurado: usa a sessão que estiver ativa
// e o mesmo modelo definido em aiSettings, sem fixar nenhum modelo.
const checkObjectiveCompletion = async (
  objective: string,
  conversation: Message[],
  aiSettings: IOpenAi,
  openai: SessionOpenAi | null,
  gemini: SessionGemini | null
): Promise<boolean> => {
  if (!objective || (!openai && !gemini)) return false;

  try {
    // Preparar histórico da conversa para análise.
    // Ordena por data antes de cortar: quem chama busca as mensagens em DESC,
    // então um .slice(-5) direto pegaria as MAIS ANTIGAS e ainda invertidas.
    const conversationText = [...conversation]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-5) // 5 mensagens mais recentes, em ordem cronológica
      .map(msg => `${msg.fromMe ? 'Bot' : 'User'}: ${msg.body}`)
      .join('\n');

    const analysisPrompt = `
Objetivo: ${objective}

Conversa:
${conversationText}

Pergunta: O objetivo foi completado com sucesso? Responda apenas "SIM" ou "NÃO".
`;

    let result = "";

    if (openai) {
      const response = await openai.chat.completions.create({
        model: aiSettings.model,
        messages: [{ role: "user", content: analysisPrompt }],
        max_tokens: 10,
        temperature: 0
      });
      result = response.choices[0]?.message?.content || "";
    } else if (gemini) {
      const model = gemini.getGenerativeModel({
        model: aiSettings.model,
        generationConfig: { maxOutputTokens: 10, temperature: 0 }
      });
      const response = await model.generateContent(analysisPrompt);
      result = response.response.text() || "";
    }

    // Tolerante a pontuação e texto extra ("Sim.", "SIM, o objetivo..."),
    // já que nem todo provedor respeita a instrução de responder só uma palavra.
    return /^\s*SIM\b/i.test(result);

  } catch (error) {
    logger.error("[AI SERVICE] Erro ao verificar completude do objetivo:", error);
    return false;
  }
};

// Função para retornar ao fluxo
const returnToFlow = async (ticket: Ticket, reason: string): Promise<void> => {
  try {
    const flowContinuation = (ticket.dataWebhook && typeof ticket.dataWebhook === "object" && "flowContinuation" in ticket.dataWebhook)
      ? (ticket.dataWebhook as any).flowContinuation
      : undefined;

    if (!flowContinuation || !flowContinuation.nextNodeId) {
      logger.warn(`[FLOW CONTINUATION] Informações de continuação não encontradas - ticket ${ticket.id}`);
      await ticket.update({
        useIntegration: false,
        isBot: false,
        dataWebhook: null
      });
      return;
    }

    logger.info(`[FLOW CONTINUATION] Retornando ao fluxo - ticket ${ticket.id}, razão: ${reason}`);

    // Enviar mensagem de transição
    const transitionMessages = {
      user_requested: "Perfeito! Vou prosseguir com o atendimento.",
      max_interactions: "Obrigado pelas informações! Vou continuar com o próximo passo.",
      timeout: "Vou prosseguir com o atendimento.",
      objective_completed: "Ótimo! Completamos essa etapa. Vamos continuar!"
    };

    const transitionMessage = transitionMessages[reason] || "Continuando...";
    
    // Enviar mensagem de transição
    const wbot = getWbot(ticket.whatsappId);
    const sentMessage = await wbot.sendMessage(getJidOf(ticket.contact), {
      text: transitionMessage
    });
    await verifyMessage(sentMessage!, ticket, ticket.contact);

    // Restaurar estado do fluxo
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: flowContinuation.originalDataWebhook
    });

    // Continuar fluxo no próximo nó
    if (flowContinuation.nextNodeId) {
      logger.info(`[FLOW CONTINUATION] Continuando fluxo no nó ${flowContinuation.nextNodeId} - ticket ${ticket.id}`);
      
      const { ActionsWebhookService } = await import("../WebhookService/ActionsWebhookService");
      
      const flow = await FlowBuilderModel.findOne({
        where: { id: ticket.flowStopped }
      });
      
      if (flow) {
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];
        
        await ActionsWebhookService(
          ticket.whatsappId,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          flowContinuation.nextNodeId,
          flowContinuation.originalDataWebhook,
          "",
          ticket.hashFlowId || "",
          null,
          ticket.id,
          {
            number: ticket.contact.number,
            name: ticket.contact.name,
            email: ticket.contact.email || ""
          }
        );
      }
    }

  } catch (error) {
    logger.error(`[FLOW CONTINUATION] Erro ao retornar ao fluxo:`, error);
    
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null
    });
  }
};

// Prepara as mensagens de IA a partir das mensagens passadas
const prepareMessagesAI = (pastMessages: Message[], isGeminiModel: boolean, promptSystem: string): any[] => {
  const messagesAI: any[] = [];

  // Para OpenAI, incluir o prompt do sistema como 'system' role
  // Para Gemini, passamos o prompt do sistema separadamente
  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  // Mapear mensagens passadas para formato da IA
  for (const message of pastMessages) {
    if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
      if (message.fromMe) {
        messagesAI.push({ role: "assistant", content: message.body });
      } else {
        messagesAI.push({ role: "user", content: message.body });
      }
    }
  }

  return messagesAI;
};

// Processa a resposta da IA (texto ou áudio)
const processResponse = async (
  responseText: string,
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  aiSettings: IOpenAi,
  ticketTraking: TicketTraking
): Promise<void> => {
  let response = responseText;

  // Verificar se o usuário pediu para falar com atendente
  const userMessage = getBodyMessage(msg) || "";
  const userRequestedTransfer = detectTransferRequest(userMessage);

  if (userRequestedTransfer) {
    logger.info(`[AI SERVICE] Usuário solicitou transferência para atendente - ticket ${ticket.id}`);
    
    // Desabilitar modo IA
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null,
      status: "pending"
    });

    const transferMessage = "Entendi que você gostaria de falar com um atendente humano. Estou transferindo você agora. Aguarde um momento!";
    
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${transferMessage}`,
    });
    
    await verifyMessage(sentMessage!, ticket, contact);

    if (aiSettings.queueId && aiSettings.queueId > 0) {
      await transferQueue(aiSettings.queueId, ticket, contact);
    }

    logger.info(`[AI SERVICE] Ticket ${ticket.id} transferido para atendimento humano`);
    return;
  }

  // Verificar ação de transferência da IA
  if (response?.toLowerCase().includes("ação: transferir para o setor de atendimento")) {
    logger.info(`[AI SERVICE] IA solicitou transferência para atendente - ticket ${ticket.id}`);
    
    await ticket.update({
      useIntegration: false,
      isBot: false,
      dataWebhook: null,
      status: "pending"
    });

    if (aiSettings.queueId && aiSettings.queueId > 0) {
      await transferQueue(aiSettings.queueId, ticket, contact);
    }
    
    response = response.replace(/ação: transferir para o setor de atendimento/i, "").trim();
    
    logger.info(`[AI SERVICE] Ticket ${ticket.id} transferido por solicitação da IA`);
  }

  if (!response && !userRequestedTransfer) {
    return;
  }

  const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

  // Enviar resposta baseada no formato preferido (texto ou voz)
  // IMPORTANTE: Gemini sempre responde em texto, OpenAI pode usar voz
  const useVoice = aiSettings.provider === "openai" && aiSettings.voice !== "texto";
  
  if (!useVoice) {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`,
    });
    await verifyMessage(sentMessage!, ticket, contact);
  } else {
    // Apenas OpenAI pode usar voz
    const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
    try {
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response),
        `${publicFolder}/${fileNameWithOutExtension}`,
        aiSettings.voiceKey,
        aiSettings.voiceRegion,
        aiSettings.voice,
        "mp3"
      );
      const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
        mimetype: "audio/mpeg",
        ptt: true,
      });
      await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
    } catch (error) {
      console.error(`Erro para responder com audio: ${error}`);
      // Fallback para texto
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`,
      });
      await verifyMessage(sentMessage!, ticket, contact);
    }
  }
};

// Manipula requisição OpenAI
const handleOpenAIRequest = async (openai: SessionOpenAi, messagesAI: any[], aiSettings: IOpenAi): Promise<string> => {
  try {
    const chat = await openai.chat.completions.create({
      model: aiSettings.model,
      messages: messagesAI as any,
      max_tokens: aiSettings.maxTokens,
      temperature: aiSettings.temperature,
    });
    return chat.choices[0].message?.content || "";
  } catch (error) {
    console.error("OpenAI request error:", error);
    throw error;
  }
};

// Manipula requisição Gemini
const handleGeminiRequest = async (
  gemini: SessionGemini,
  messagesAI: any[],
  aiSettings: IOpenAi,
  newMessage: string,
  promptSystem: string
): Promise<string> => {
  try {
    const model = gemini.getGenerativeModel({
      model: aiSettings.model,
      systemInstruction: promptSystem,
    });

    // Converte o histórico para o formato do Gemini
    const geminiHistory: Content[] = messagesAI.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(newMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini request error:", error);
    throw error;
  }
};

// Função principal para manipular interações de IA
export const handleOpenAiFlow = async (
  aiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent?: Message | undefined,
  ticketTraking?: TicketTraking
): Promise<void> => {
  try {
    if (!aiSettings) {
      logger.error("[AI SERVICE] Configurações da IA não fornecidas");
      return;
    }

    if (contact.disableBot) {
      logger.info("[AI SERVICE] Bot desabilitado para este contato");
      return;
    }

    // Verificar modo temporário e continuação de fluxo
    const isTemporaryMode = aiSettings.flowMode === "temporary";
    const flowContinuation = (ticket.dataWebhook && typeof ticket.dataWebhook === "object" && "flowContinuation" in ticket.dataWebhook)
      ? (ticket.dataWebhook as any).flowContinuation
      : undefined;

    // Verificações para voltar ao fluxo (apenas no modo temporário)
    if (isTemporaryMode && flowContinuation) {
      const bodyMessage = getBodyMessage(msg) || "";
      
      // 1. Verificar palavras-chave de continuação
      if (detectFlowContinuation(bodyMessage, aiSettings.continueKeywords || [])) {
        logger.info(`[AI SERVICE] Usuário solicitou continuação do fluxo - ticket ${ticket.id}`);
        return await returnToFlow(ticket, "user_requested");
      }

      // 2. Verificar limite de interações
      if (aiSettings.maxInteractions && flowContinuation.interactionCount >= aiSettings.maxInteractions) {
        logger.info(`[AI SERVICE] Limite de interações atingido - ticket ${ticket.id}`);
        return await returnToFlow(ticket, "max_interactions");
      }

      // 3. Verificar timeout
      if (aiSettings.completionTimeout) {
        const startTime = new Date(flowContinuation.startTime);
        const now = new Date();
        const minutesElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60);
        
if (minutesElapsed >= aiSettings.completionTimeout) {
          logger.info(`[AI SERVICE] Timeout atingido - ticket ${ticket.id}`);
          return await returnToFlow(ticket, "timeout");
        }
      }

      // Incrementar contador de interações
      await ticket.update({
        dataWebhook: {
          ...ticket.dataWebhook,
          flowContinuation: {
            ...flowContinuation,
            interactionCount: flowContinuation.interactionCount + 1
          }
        }
      });
    }

    // Validação da estrutura da mensagem
    let bodyMessage = "";
    
    try {
      if (msg && msg.message) {
        bodyMessage = getBodyMessage(msg) || "";
      } else if (msg && msg.key) {
        const messageFromDB = await Message.findOne({
          where: { wid: msg.key.id },
          order: [['createdAt', 'DESC']]
        });
        
        if (messageFromDB) {
          bodyMessage = messageFromDB.body || "";
          logger.info(`[AI SERVICE] Usando mensagem do banco: "${bodyMessage}"`);
        }
      }
    } catch (error) {
      logger.warn("[AI SERVICE] Erro ao extrair bodyMessage, tentando buscar última mensagem:", error);
      
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: false
        },
        order: [['createdAt', 'DESC']]
      });
      
      if (lastMessage) {
        bodyMessage = lastMessage.body || "";
        logger.info(`[AI SERVICE] Usando última mensagem como fallback: "${bodyMessage}"`);
      }
    }

    // Se não tem bodyMessage e não é áudio, não processar
    if (!bodyMessage && !msg.message?.audioMessage) {
      logger.warn("[AI SERVICE] Nenhum conteúdo de texto ou áudio encontrado");
      return;
    }

    if (!aiSettings.model) {
      logger.error("[AI SERVICE] Modelo não definido nas configurações");
      return;
    }

    if (msg.messageStubType) {
      logger.info("[AI SERVICE] Ignorando evento de grupo (messageStubType)");
      return;
    }

    const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

    // Definir se é OpenAI ou Gemini baseado no provider
    const provider = aiSettings.provider || (aiSettings.model.startsWith('gpt-') ? 'openai' : 'gemini');
    const isOpenAIModel = provider === 'openai';
    const isGeminiModel = provider === 'gemini';

    if (!isOpenAIModel && !isGeminiModel) {
      logger.error(`[AI SERVICE] Provider não suportado: ${provider}`);
      await wbot.sendMessage(msg.key.remoteJid!, { 
        text: "Desculpe, o modelo de IA configurado não é suportado." 
      });
      return;
    }

    let openai: SessionOpenAi | null = null;
    let gemini: SessionGemini | null = null;

    // Inicializar provedor de IA
    if (isOpenAIModel) {
      const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
      if (openAiIndex === -1) {
        openai = new OpenAI({ apiKey: aiSettings.apiKey }) as SessionOpenAi;
        openai.id = ticket.id;
        sessionsOpenAi.push(openai);
      } else {
        openai = sessionsOpenAi[openAiIndex];
      }
    } else if (isGeminiModel) {
      const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);
      if (geminiIndex === -1) {
        gemini = new GoogleGenerativeAI(aiSettings.apiKey) as SessionGemini;
        gemini.id = ticket.id;
        sessionsGemini.push(gemini);
      } else {
        gemini = sessionsGemini[geminiIndex];
      }
    }

    // Buscar mensagens passadas para contexto
    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "ASC"]],
      limit: aiSettings.maxMessages > 0 ? aiSettings.maxMessages : undefined
    });

    // Formatar prompt do sistema
    const clientName = sanitizeName(contact.name || "Amigo(a)");
    const promptSystem = `Instruções do Sistema:
    - Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido.
    - Certifique-se de que a resposta tenha até ${aiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
    - Sempre que possível, inclua o nome do cliente para tornar o atendimento mais pessoal e gentil.
    - Se for preciso transferir para outro setor, comece a resposta com 'Ação: Transferir para o setor de atendimento'.
    
    Prompt Específico:
    ${aiSettings.prompt}
    
    Siga essas instruções com cuidado para garantir um atendimento claro e amigável em todas as respostas.`;

    // Processar mensagem de texto
    if (bodyMessage) {
      const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

      try {
        let responseText: string | null = null;

        if (isOpenAIModel && openai) {
          messagesAI.push({ role: "user", content: bodyMessage });
          responseText = await handleOpenAIRequest(openai, messagesAI, aiSettings);
        } else if (isGeminiModel && gemini) {
          responseText = await handleGeminiRequest(gemini, messagesAI, aiSettings, bodyMessage, promptSystem);
        }

        if (!responseText) {
          logger.error("[AI SERVICE] Nenhuma resposta do provedor de IA");
          return;
        }

        await processResponse(responseText, wbot, msg, ticket, contact, aiSettings, ticketTraking);
        
        logger.info(`[AI SERVICE] Resposta processada com sucesso para ticket ${ticket.id}`);

        // APÓS RESPOSTA: Verificar se deve continuar fluxo por objetivo completado
        if (isTemporaryMode && aiSettings.autoCompleteOnObjective && aiSettings.objective && (openai || gemini)) {
          const recentMessages = await Message.findAll({
            where: { ticketId: ticket.id },
            order: [["createdAt", "DESC"]],
            limit: 10
          });

          const objectiveCompleted = await checkObjectiveCompletion(
            aiSettings.objective,
            recentMessages,
            aiSettings,
            openai,
            gemini
          );

          if (objectiveCompleted) {
            logger.info(`[AI SERVICE] Objetivo completado automaticamente - ticket ${ticket.id}`);
            return await returnToFlow(ticket, "objective_completed");
          }
        }

      } catch (error: any) {
        logger.error("[AI SERVICE] Falha na requisição para IA:", error);
        
        const errorMessage = "Desculpe, estou com dificuldades técnicas para processar sua solicitação no momento. Por favor, tente novamente mais tarde.";
        
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: errorMessage
        });
        
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }
    // Processar áudio (apenas para OpenAI)
    else if (msg.message?.audioMessage && mediaSent && isOpenAIModel) {
      if (!openai) {
        logger.error("[AI SERVICE] Sessão OpenAI necessária para transcrição mas não inicializada");
        await wbot.sendMessage(msg.key.remoteJid!, { 
          text: "Desculpe, a transcrição de áudio não está configurada corretamente." 
        });
        return;
      }

      try {
        const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
        const audioFilePath = `${publicFolder}/${mediaUrl}`;

        if (!fs.existsSync(audioFilePath)) {
          logger.error(`[AI SERVICE] Arquivo de áudio não encontrado: ${audioFilePath}`);
          await wbot.sendMessage(msg.key.remoteJid!, { 
            text: "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente." 
          });
          return;
        }

        const file = fs.createReadStream(audioFilePath);
        const transcriptionResult = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: file,
        });

        const transcription = transcriptionResult.text;

        if (!transcription) {
          logger.warn("[AI SERVICE] Transcrição vazia recebida");
          await wbot.sendMessage(msg.key.remoteJid!, { 
            text: "Desculpe, não consegui entender o áudio. Tente novamente ou envie uma mensagem de texto." 
          });
          return;
        }

        // Enviar transcrição para o usuário
        const sentTranscriptMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: `🎤 *Sua mensagem de voz:* ${transcription}`,
        });
        await verifyMessage(sentTranscriptMessage!, ticket, contact);

        // Obter resposta da IA para a transcrição
        const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);
        let responseText: string | null = null;
        
        if (isOpenAIModel) {
          messagesAI.push({ role: "user", content: transcription });
          responseText = await handleOpenAIRequest(openai, messagesAI, aiSettings);
        } else if (isGeminiModel && gemini) {
          responseText = await handleGeminiRequest(gemini, messagesAI, aiSettings, transcription, promptSystem);
        }
        
        if (responseText) {
          await processResponse(responseText, wbot, msg, ticket, contact, aiSettings, ticketTraking);
        }

      } catch (error: any) {
        logger.error("[AI SERVICE] Erro no processamento de áudio:", error);
        const errorMessage = error?.response?.error?.message || error.message || "Erro desconhecido";
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: `Desculpe, houve um erro ao processar seu áudio: ${errorMessage}`,
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    } else if (msg.message?.audioMessage && isGeminiModel) {
      // Gemini não suporta áudio, apenas texto
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Desculpe, no momento só posso processar mensagens de texto. Por favor, envie sua pergunta por escrito.",
      });
      await verifyMessage(sentMessage!, ticket, contact);
    }

  } catch (error) {
    logger.error("[AI SERVICE] Erro geral no serviço:", error);
    
    try {
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Desculpe, ocorreu um erro interno. Por favor, tente novamente mais tarde.",
      });
      await verifyMessage(sentMessage!, ticket, contact);
    } catch (sendError) {
      logger.error("[AI SERVICE] Erro ao enviar mensagem de erro:", sendError);
    }
  }
};

export default handleOpenAiFlow;