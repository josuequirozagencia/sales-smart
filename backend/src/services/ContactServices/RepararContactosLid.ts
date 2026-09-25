import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import WhatsappLidMap from "../../models/WhatsapplidMap";
import logger from "../../utils/logger";
import {
  esFotoVacia,
  nombreEsIdentificador,
  parDeMensajeGuardado,
  soloDigitos
} from "../../helpers/LidTelefono";

/**
 * Repara los contactos a los que se les guardo el LID en el campo del numero.
 *
 * No hace falta preguntarle nada a WhatsApp: los mensajes ya guardados traen
 * el telefono en su dataJson (key.senderPn). De 863 mensajes de la empresa 1,
 * 377 lo traen.
 *
 * Lo que NO hace: fusionar contactos. Si el telefono ya pertenece a otro
 * contacto, el de LID se deja como esta y se cuenta aparte. Fusionar implica
 * mover mensajes y tickets y borrar una ficha, y eso no se hace sin que
 * alguien lo pida mirando los dos contactos.
 */

export interface ResultadoReparacion {
  revisados: number;
  reparados: number;
  sinTelefono: number;
  telefonoOcupado: number;
  detalles: string[];
}

/** LID -> telefono, sacado de los mensajes guardados de esa empresa. */
export const mapaLidTelefono = async (
  companyId: number
): Promise<Map<string, string>> => {
  const mensajes = await Message.findAll({
    where: {
      companyId,
      dataJson: { [Op.like]: "%senderPn%" }
    },
    attributes: ["dataJson"],
    raw: true
  });

  const mapa = new Map<string, string>();

  for (const mensaje of mensajes) {
    const par = parDeMensajeGuardado((mensaje as any).dataJson);
    if (par && !mapa.has(par.lid)) {
      mapa.set(par.lid, par.telefono);
    }
  }

  return mapa;
};

export const repararContactosLid = async (
  companyId: number
): Promise<ResultadoReparacion> => {
  const resultado: ResultadoReparacion = {
    revisados: 0,
    reparados: 0,
    sinTelefono: 0,
    telefonoOcupado: 0,
    detalles: []
  };

  const contactos = await Contact.findAll({
    where: {
      companyId,
      number: { [Op.like]: "%@lid%" }
    }
  });

  resultado.revisados = contactos.length;
  if (!contactos.length) return resultado;

  const mapa = await mapaLidTelefono(companyId);

  for (const contacto of contactos) {
    const lid = soloDigitos(contacto.number);
    const telefono = mapa.get(lid);

    if (!telefono) {
      resultado.sinTelefono += 1;
      continue;
    }

    const ocupado = await Contact.findOne({
      where: { companyId, number: telefono, id: { [Op.ne]: contacto.id } }
    });

    if (ocupado) {
      resultado.telefonoOcupado += 1;
      resultado.detalles.push(
        `contacto ${contacto.id} (lid ${lid}) -> ${telefono} ya es del contacto ${ocupado.id}`
      );
      continue;
    }

    const cambios: any = { number: telefono, lid };

    // El nombre quedo siendo los digitos del LID porque no llego pushName.
    // El telefono no es un nombre, pero al menos es el dato que el asesor
    // reconoce; el pushName lo sustituira en cuanto el cliente escriba.
    if (nombreEsIdentificador(contacto.name)) {
      cambios.name = telefono;
    }

    // Se borra el nopicture guardado para que se vuelva a intentar la foto,
    // esta vez contra un identificador que WhatsApp sabe resolver.
    if (esFotoVacia(contacto.profilePicUrl)) {
      cambios.profilePicUrl = null;
    }

    await contacto.update(cambios);

    const yaMapeado = await WhatsappLidMap.findOne({
      where: { companyId, lid }
    });
    if (!yaMapeado) {
      await WhatsappLidMap.create({
        companyId,
        lid,
        contactId: contacto.id
      } as any);
    }

    resultado.reparados += 1;
  }

  logger.info(
    `[LID] Empresa ${companyId}: ${resultado.reparados} contactos reparados, ` +
      `${resultado.sinTelefono} sin telefono en el historial, ` +
      `${resultado.telefonoOcupado} con el telefono ya ocupado`
  );

  return resultado;
};

export default repararContactosLid;
