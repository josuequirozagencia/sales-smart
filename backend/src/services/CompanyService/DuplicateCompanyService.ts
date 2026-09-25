import * as Yup from "yup";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import logger from "../../utils/logger";
import {
  borrarArchivosCopiados,
  clonarConfiguracion,
  ResumenClon
} from "./CloneCompanyConfigService";

/**
 * Duplica una empresa: crea otra con su plan y le clona la configuracion.
 *
 * Solo para superadministrador (el controlador lo comprueba).
 *
 * QUE LLEVA LA EMPRESA NUEVA
 *   Heredado de la origen: plan, estado, vencimiento, recurrencia,
 *   generacion de facturas, moneda, metodo de pago y horario de atencion.
 *   Y toda la configuracion que copia CloneCompanyConfigService.
 *   Escrito por el superadministrador: nombre, email y contrasena del admin,
 *   telefono y documento (el modal propone los dos ultimos con los de la
 *   origen).
 *
 * QUE NO LLEVA
 *   Lo que el clonado deja fuera (canales, usuarios, contactos, tickets y
 *   demas datos operativos, anuncios, FlowBuilder) y la tabla Settings de
 *   la origen: en la empresa 1 guarda las claves de las pasarelas de pago y
 *   el whitelabel de toda la plataforma. Su unico usuario es el admin.
 *
 * COMO
 *   Empresa, admin y configuracion van en UNA transaccion: si el clonado
 *   falla, la empresa tampoco se crea. Nace aprobada por quien la duplica.
 */

interface Peticion {
  sourceCompanyId: number;
  name: string;
  email: string;
  password: string;
  phone?: string;
  document?: string;
  userId: number;
}

export interface ResumenDuplicado {
  empresa: { id: number; name: string; email: string; planId: number };
  clon: ResumenClon;
}

const esquema = Yup.object().shape({
  name: Yup.string()
    .min(2, "ERR_DUPLICATE_INVALID_NAME")
    .required("ERR_DUPLICATE_INVALID_NAME"),
  email: Yup.string()
    .email("ERR_DUPLICATE_INVALID_EMAIL")
    .required("ERR_DUPLICATE_INVALID_EMAIL"),
  // El mismo minimo que exige el alta normal de empresas y de usuarios.
  password: Yup.string()
    .min(5, "ERR_DUPLICATE_INVALID_PASSWORD")
    .required("ERR_DUPLICATE_INVALID_PASSWORD")
});

const DuplicateCompanyService = async ({
  sourceCompanyId,
  name,
  email,
  password,
  phone,
  document,
  userId
}: Peticion): Promise<ResumenDuplicado> => {
  const origen = Number(sourceCompanyId);

  if (!Number.isInteger(origen) || origen <= 0) {
    throw new AppError("ERR_CLONE_INVALID_COMPANIES", 400);
  }

  const nombre = String(name || "").trim();
  const correo = String(email || "").trim();

  try {
    await esquema.validate({ name: nombre, email: correo, password });
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }

  const empresaOrigen = await Company.findByPk(origen);

  if (!empresaOrigen) {
    throw new AppError("ERR_CLONE_COMPANY_NOT_FOUND", 404);
  }

  // Comprobaciones previas para dar un error claro. La carrera entre dos
  // peticiones la cubren los indices unicos de Companies.name y Users.email.
  if (await Company.findOne({ where: { name: nombre } })) {
    throw new AppError("ERR_DUPLICATE_NAME_IN_USE", 409);
  }

  if (await User.findOne({ where: { email: correo } })) {
    throw new AppError("ERR_DUPLICATE_EMAIL_IN_USE", 409);
  }

  const archivosCreados: string[] = [];

  try {
    const resultado = await sequelize.transaction(async t => {
      const documento =
        document !== undefined ? String(document) : empresaOrigen.document || "";

      // El modelo declara dueDate como string, pero la columna es de fecha y
      // se lee como Date: pasada tal cual, la validacion del modelo la
      // rechaza ("cannot be an array or an object").
      const vencimiento = empresaOrigen.dueDate as unknown;

      const empresa = await Company.create(
        {
          name: nombre,
          email: correo,
          phone: phone !== undefined ? String(phone).trim() : empresaOrigen.phone,
          // Solo digitos, como guarda el alta normal.
          document: documento.replace(/\D/g, ""),
          status: empresaOrigen.status,
          planId: empresaOrigen.planId,
          dueDate:
            vencimiento instanceof Date ? vencimiento.toISOString() : vencimiento || null,
          recurrence: empresaOrigen.recurrence,
          paymentMethod: empresaOrigen.paymentMethod,
          generateInvoice: empresaOrigen.generateInvoice,
          currency: empresaOrigen.currency,
          schedules: empresaOrigen.schedules,
          approvalStatus: "approved",
          approvedByUserId: userId,
          approvalAt: new Date()
        } as any,
        { transaction: t }
      );

      // Mismo admin que crea el alta normal. La contrasena la cifra el hook
      // del modelo.
      await User.create(
        {
          name: nombre,
          email: correo,
          password,
          profile: "admin",
          companyId: empresa.id
        } as any,
        { transaction: t }
      );

      const clon = await clonarConfiguracion(
        t,
        origen,
        empresa.id,
        archivosCreados,
        userId
      );

      return {
        empresa: {
          id: empresa.id,
          name: empresa.name,
          email: empresa.email,
          planId: empresa.planId
        },
        clon
      };
    });

    logger.info(
      `[Duplicar] empresa ${origen} duplicada como ${resultado.empresa.id} (${resultado.empresa.name}): ${JSON.stringify(resultado.clon.copiados)}`
    );

    return resultado;
  } catch (err) {
    // La transaccion ya se deshizo; los archivos copiados, no.
    borrarArchivosCopiados(archivosCreados);

    // Otra peticion tomo el mismo nombre o email entre la comprobacion y el
    // insert.
    if (err?.name === "SequelizeUniqueConstraintError") {
      const tabla = err.parent?.table;
      if (tabla === "Users") throw new AppError("ERR_DUPLICATE_EMAIL_IN_USE", 409);
      if (tabla === "Companies") throw new AppError("ERR_DUPLICATE_NAME_IN_USE", 409);
    }

    throw err;
  }
};

export default DuplicateCompanyService;
