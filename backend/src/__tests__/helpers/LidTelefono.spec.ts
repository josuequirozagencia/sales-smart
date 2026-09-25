import {
  esFotoVacia,
  esLid,
  lidDeClave,
  nombreEsIdentificador,
  parDeMensajeGuardado,
  soloDigitos,
  telefonoDeClave
} from "../../helpers/LidTelefono";

// WhatsApp direcciona cada vez mas por identificadores anonimos (@lid). Lo
// que se prueba aqui es la frontera entre ese identificador y el telefono
// real: confundirlos es lo que dejo a 47 de 55 contactos con un numero que
// no existe, sin foto y sin forma de llamarlos.

describe("telefonoDeClave", () => {
  it("saca el telefono que acompana a un mensaje por LID", () => {
    const clave = {
      remoteJid: "262934307541069@lid",
      fromMe: false,
      senderPn: "593986567051@s.whatsapp.net"
    };

    expect(telefonoDeClave(clave)).toBe("593986567051");
  });

  it("acepta el telefono del participante en un grupo", () => {
    const clave = {
      remoteJid: "120363000000000000@g.us",
      participant: "262934307541069@lid",
      participantPn: "593986567051@s.whatsapp.net",
      fromMe: false
    };

    expect(telefonoDeClave(clave)).toBe("593986567051");
  });

  it("no devuelve nada si el mensaje no trae telefono", () => {
    expect(
      telefonoDeClave({ remoteJid: "262934307541069@lid", fromMe: false })
    ).toBeUndefined();
  });

  it("ignora los mensajes propios", () => {
    // En un mensaje nuestro el senderPn es el numero de la empresa, no el del
    // cliente: tomarlo por telefono del contacto seria mezclar las fichas.
    const clave = {
      remoteJid: "262934307541069@lid",
      fromMe: true,
      senderPn: "593999999999@s.whatsapp.net"
    };

    expect(telefonoDeClave(clave)).toBeUndefined();
  });

  it("rechaza lo que no parezca un telefono", () => {
    expect(
      telefonoDeClave({ senderPn: "12@s.whatsapp.net", fromMe: false })
    ).toBeUndefined();
    expect(
      telefonoDeClave({ senderPn: "262934307541069@lid", fromMe: false })
    ).toBeUndefined();
  });
});

describe("lidDeClave", () => {
  it("devuelve el identificador sin sufijo", () => {
    expect(lidDeClave({ remoteJid: "262934307541069@lid" })).toBe(
      "262934307541069"
    );
  });

  it("prefiere el participante en un grupo", () => {
    expect(
      lidDeClave({
        remoteJid: "120363000000000000@g.us",
        participant: "262934307541069@lid"
      })
    ).toBe("262934307541069");
  });

  it("no devuelve nada si no hay LID", () => {
    expect(
      lidDeClave({ remoteJid: "593986567051@s.whatsapp.net" })
    ).toBeUndefined();
  });
});

describe("parDeMensajeGuardado", () => {
  it("saca el par del historial, que es de donde se reparan los contactos", () => {
    const dataJson = JSON.stringify({
      key: {
        remoteJid: "262934307541069@lid",
        fromMe: false,
        id: "ACE94ED5FED5A260E61A8D07F76C58C0",
        senderPn: "593986567051@s.whatsapp.net"
      }
    });

    expect(parDeMensajeGuardado(dataJson)).toEqual({
      lid: "262934307541069",
      telefono: "593986567051"
    });
  });

  it("aguanta un dataJson roto sin tirar la reparacion", () => {
    expect(parDeMensajeGuardado("{senderPn: esto no es json")).toBeNull();
    expect(parDeMensajeGuardado(null)).toBeNull();
    expect(parDeMensajeGuardado("{}")).toBeNull();
  });
});

describe("esLid, soloDigitos, nombreEsIdentificador, esFotoVacia", () => {
  it("reconoce un LID", () => {
    expect(esLid("262934307541069@lid")).toBe(true);
    expect(esLid("593986567051@s.whatsapp.net")).toBe(false);
    expect(esLid(undefined)).toBe(false);
  });

  it("deja solo los digitos", () => {
    expect(soloDigitos("593986567051@s.whatsapp.net")).toBe("593986567051");
    expect(soloDigitos("")).toBe("");
  });

  it("distingue un nombre de un identificador colado por nombre", () => {
    expect(nombreEsIdentificador("257720267587711")).toBe(true);
    expect(nombreEsIdentificador("Alexandra Estrada")).toBe(false);
    // Un nombre corto de digitos puede ser un apodo o un numero de orden: no
    // se toca.
    expect(nombreEsIdentificador("2024")).toBe(false);
  });

  it("trata el nopicture guardado como ausencia de foto", () => {
    // Guardar esa URL era lo que dejaba al contacto marcado como "ya tiene
    // foto" para siempre.
    expect(esFotoVacia("http://localhost:3000/nopicture.png")).toBe(true);
    expect(esFotoVacia("")).toBe(true);
    expect(esFotoVacia(null)).toBe(true);
    expect(esFotoVacia("https://pps.whatsapp.net/v/t61.jpg")).toBe(false);
  });
});
