import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import AppError from "../../errors/AppError";
import { MAX_KNOWLEDGE_CHARS } from "./AiAgentService";

/**
 * Texto de un documento de conocimiento del agente (PDF, DOCX o texto plano).
 * En esta fase no hay RAG: el texto entero va al prompt de sistema, asi que se
 * limita a MAX_KNOWLEDGE_CHARS y se avisa si se ha recortado.
 */
export interface TextoExtraido {
  text: string;
  fileName: string;
  chars: number;
  truncated: boolean;
}

const limpiar = (texto: string): string =>
  texto
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const extraerTextoDocumento = async (
  buffer: Buffer,
  nombre: string,
  mimetype: string
): Promise<TextoExtraido> => {
  const extension = (nombre.split(".").pop() || "").toLowerCase();
  let texto: string;

  try {
    if (extension === "pdf" || mimetype === "application/pdf") {
      texto = (await pdfParse(buffer)).text;
    } else if (
      extension === "docx" ||
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      texto = (await mammoth.extractRawText({ buffer })).value;
    } else if (["txt", "md", "csv"].includes(extension) || mimetype.startsWith("text/")) {
      texto = buffer.toString("utf8");
    } else {
      throw new AppError("ERR_AI_AGENT_KNOWLEDGE_TYPE", 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_AI_AGENT_KNOWLEDGE_UNREADABLE", 400);
  }

  const limpio = limpiar(texto || "");
  if (!limpio) throw new AppError("ERR_AI_AGENT_KNOWLEDGE_EMPTY", 400);

  const truncated = limpio.length > MAX_KNOWLEDGE_CHARS;
  const final = truncated ? limpio.slice(0, MAX_KNOWLEDGE_CHARS) : limpio;
  return { text: final, fileName: nombre, chars: final.length, truncated };
};
