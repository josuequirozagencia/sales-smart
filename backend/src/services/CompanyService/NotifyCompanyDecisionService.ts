import Company from "../../models/Company";
import User from "../../models/User";
import { SendMail } from "../../helpers/SendMail";
import GetPublicSettingService from "../SettingServices/GetPublicSettingService";
import logger from "../../utils/logger";

/**
 * Avisa por correo de la decision tomada sobre una solicitud.
 *
 * NUNCA lanza. La decision ya esta guardada cuando se llama aqui: si el
 * correo esta mal configurado —que hoy es el caso— no puede deshacerse una
 * aprobacion por eso. El fallo se anota en el log del servidor.
 *
 * No incluye contrasenas ni enlaces con permisos. Solo dice que paso y a
 * donde escribir si no se esta de acuerdo.
 */

type Decision = "approved" | "rejected" | "suspended";

interface Request {
  company: Company;
  status: Decision | string;
  reason?: string | null;
}

/** Lineas de contacto de soporte, si estan configuradas. */
const lineasDeSoporte = async (): Promise<string[]> => {
  const [correo, telefono, nota] = await Promise.all([
    GetPublicSettingService({ key: "supportEmail" }),
    GetPublicSettingService({ key: "supportPhone" }),
    GetPublicSettingService({ key: "supportNote" })
  ]);

  const lineas: string[] = [];
  if (correo) lineas.push(`Correo: ${correo}`);
  if (telefono) lineas.push(`Telefono: ${telefono}`);
  if (nota) lineas.push(nota);

  // Sin ningun dato configurado no se pone una cabecera vacia que dijera
  // "escribenos a" sin decir a donde.
  if (lineas.length === 0) return [];
  return ["", "Si quieres revisarlo, puedes escribirnos:", ...lineas];
};

const NotifyCompanyDecisionService = async ({
  company,
  status,
  reason
}: Request): Promise<void> => {
  try {
    // El correo de la empresa puede estar vacio; en ese caso se busca el de
    // su administrador, que es quien se registro.
    let destino = company.email;
    if (!destino) {
      const admin = await User.findOne({
        where: { companyId: company.id, profile: "admin" },
        order: [["id", "ASC"]]
      });
      destino = admin ? admin.email : null;
    }

    if (!destino) {
      logger.warn(
        `[CompanyDecision] empresa ${company.id} sin correo al que avisar`
      );
      return;
    }

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";

    let asunto: string;
    let lineas: string[];

    if (status === "approved") {
      asunto = `Tu acceso a ${company.name} ya esta activo`;
      lineas = [
        `Hola,`,
        "",
        `La solicitud de ${company.name} fue aprobada.`,
        "",
        `Ya puedes entrar con tu correo y tu contrasena:`,
        `${frontend}/login`
      ];
    } else if (status === "rejected") {
      asunto = `Sobre la solicitud de ${company.name}`;
      lineas = [
        `Hola,`,
        "",
        `La solicitud de ${company.name} no fue aprobada.`,
        ...(reason ? ["", `Motivo: ${reason}`] : []),
        ...(await lineasDeSoporte())
      ];
    } else if (status === "suspended") {
      asunto = `El acceso de ${company.name} quedo suspendido`;
      lineas = [
        `Hola,`,
        "",
        `El acceso de ${company.name} quedo suspendido temporalmente.`,
        ...(reason ? ["", `Motivo: ${reason}`] : []),
        ...(await lineasDeSoporte())
      ];
    } else {
      // "pending" u otro estado no genera aviso: no hay nada que contar.
      return;
    }

    await SendMail({
      to: destino,
      subject: asunto,
      text: lineas.join("\n")
    });
  } catch (err) {
    logger.error(`[CompanyDecision] no se pudo avisar: ${err}`);
  }
};

export default NotifyCompanyDecisionService;
