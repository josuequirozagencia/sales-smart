// Utilitário para normalizar JIDs do WhatsApp
// Se vier com @lid, converte para @s.whatsapp.net (usuário) ou @g.us (grupo)

export function normalizeJid(jid: string): string {
  if (!jid) return jid;

  // O @lid tem de ser tratado ANTES das verificações de @s.whatsapp.net.
  //
  // Quando um contato chega por LID, o número é gravado já com o sufixo
  // ("112231891087528@lid") e depois alguém concatena "@s.whatsapp.net" por
  // cima. O endereço resultante contém "@s.whatsapp.net", então saía intacto
  // pela verificação seguinte e ia parar no socket como
  // "112231891087528@lid@s.whatsapp.net". O WhatsApp responde a isso com
  // stream:error / xml-not-well-formed e DERRUBA A CONEXÃO — o envio ficava
  // travado e a sessão caía.
  //
  // O endereço correto é o próprio @lid: 'lid' é um JidServer válido no
  // Baileys desta versão, então dá para enviar para ele diretamente. Trocar
  // por @s.whatsapp.net, como se fazia antes, fabricaria um telefone que não
  // existe — um LID não é um número.
  if (jid.includes('@lid')) {
    const base = jid.split('@')[0];

    // Grupos continuam indo para @g.us.
    if (jid.includes('g.us')) {
      return `${base}@g.us`;
    }

    return `${base}@lid`;
  }

  // Corrige casos onde o jid vem duplicado, ex: 5519981790250@s.whatsapp.net@s.whatsapp.net
  if (jid.includes('@s.whatsapp.net@s.whatsapp.net')) {
    return jid.replace('@s.whatsapp.net@s.whatsapp.net', '@s.whatsapp.net');
  }
  if (jid.includes('@g.us@g.us')) {
    return jid.replace('@g.us@g.us', '@g.us');
  }

  // Se já contém @s.whatsapp.net ou @g.us, retorna o próprio jid
  if (jid.includes('@s.whatsapp.net') || jid.includes('@g.us')) {
    return jid;
  }

  return jid;
} 