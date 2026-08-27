import { normalizeJid } from "../../utils";

// Normalização de endereços do WhatsApp.
//
// Vale testar com cuidado porque um endereço malformado não falha de forma
// discreta: o WhatsApp responde com stream:error / xml-not-well-formed e
// DERRUBA a conexão inteira. O sintoma para quem usa é que a mensagem fica
// "congelada" e a sessão cai.

describe("normalizeJid", () => {
  it("preserva um endereço LID", () => {
    // 'lid' é um JidServer válido no Baileys: dá para enviar direto para ele.
    // Trocá-lo por @s.whatsapp.net fabricaria um telefone inexistente, porque
    // um LID não é um número.
    expect(normalizeJid("112231891087528@lid")).toBe("112231891087528@lid");
  });

  it("corrige o LID com sufixo colado", () => {
    // Este era o caso que derrubava a conexão. O número já vinha com "@lid" e
    // outro trecho de código concatenava "@s.whatsapp.net" por cima.
    expect(normalizeJid("112231891087528@lid@s.whatsapp.net")).toBe(
      "112231891087528@lid"
    );
    expect(normalizeJid("67461068095597@lid@s.whatsapp.net")).toBe(
      "67461068095597@lid"
    );
  });

  it("manda grupos para g.us mesmo vindo por LID", () => {
    expect(normalizeJid("120363000000000000@lid@g.us")).toBe(
      "120363000000000000@g.us"
    );
  });

  it("deixa intacto um endereço de usuário normal", () => {
    expect(normalizeJid("5519981790250@s.whatsapp.net")).toBe(
      "5519981790250@s.whatsapp.net"
    );
  });

  it("deixa intacto um endereço de grupo normal", () => {
    expect(normalizeJid("120363000000000000@g.us")).toBe(
      "120363000000000000@g.us"
    );
  });

  it("corrige sufixos duplicados sem LID", () => {
    expect(normalizeJid("5519981790250@s.whatsapp.net@s.whatsapp.net")).toBe(
      "5519981790250@s.whatsapp.net"
    );
    expect(normalizeJid("120363000000000000@g.us@g.us")).toBe(
      "120363000000000000@g.us"
    );
  });

  it("devolve entradas vazias sem quebrar", () => {
    expect(normalizeJid("")).toBe("");
    expect(normalizeJid(null as any)).toBeNull();
    expect(normalizeJid(undefined as any)).toBeUndefined();
  });

  it("nunca devolve um endereço com dois servidores", () => {
    // A propriedade que realmente importa: qualquer entrada plausível deve
    // sair com no máximo um "@servidor".
    const entradas = [
      "112231891087528@lid",
      "112231891087528@lid@s.whatsapp.net",
      "5519981790250@s.whatsapp.net",
      "5519981790250@s.whatsapp.net@s.whatsapp.net",
      "120363000000000000@g.us",
      "120363000000000000@g.us@g.us",
      "120363000000000000@lid@g.us",
      "5519981790250"
    ];

    entradas.forEach(entrada => {
      const saida = normalizeJid(entrada);
      const arrobas = (saida.match(/@/g) || []).length;
      expect(arrobas).toBeLessThanOrEqual(1);
    });
  });
});
