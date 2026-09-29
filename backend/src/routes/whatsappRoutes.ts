import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import canManageConnections from "../middleware/canManageConnections";

import * as WhatsAppController from "../controllers/WhatsAppController";

import multer from "multer";
import uploadConfig from "../config/upload";
import { mediaUpload } from "../services/WhatsappService/uploadMediaAttachment";
import { deleteMedia } from "../services/WhatsappService/uploadMediaAttachment";

const upload = multer(uploadConfig);


const whatsappRoutes = express.Router();

// Leer la lista y la ficha lo necesitan pantallas de cualquier usuario
// (nuevo ticket, filtros, botones del ticket). Crear, editar, borrar o
// reiniciar, solo quien gestiona conexiones: ver canManageConnections.
whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);
whatsappRoutes.get("/whatsapp/filter", isAuth, WhatsAppController.indexFilter);
// Conexiones de TODAS las empresas: solo super (pantalla AllConnections).
whatsappRoutes.get("/whatsapp/all", isAuth, isSuper, WhatsAppController.listAll);
whatsappRoutes.get("/whatsapp/sync-templates/:whatsappId", isAuth, canManageConnections, WhatsAppController.syncTemplatesOficial);

whatsappRoutes.post("/whatsapp/", isAuth, canManageConnections, WhatsAppController.store);
whatsappRoutes.post("/facebook/", isAuth, canManageConnections, WhatsAppController.storeFacebook);
whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, canManageConnections, WhatsAppController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId", isAuth, canManageConnections, WhatsAppController.remove);
whatsappRoutes.post("/closedimported/:whatsappId", isAuth, canManageConnections, WhatsAppController.closedTickets);

//restart
whatsappRoutes.post("/whatsapp-restart/", isAuth, canManageConnections, WhatsAppController.restart);
whatsappRoutes.post("/whatsapp/:whatsappId/media-upload", isAuth, canManageConnections, upload.array("file"), mediaUpload);

whatsappRoutes.delete("/whatsapp/:whatsappId/media-upload", isAuth, canManageConnections, deleteMedia);


// Las rutas -admin buscan la conexion sin filtrar por empresa: solo super.
whatsappRoutes.delete("/whatsapp-admin/:whatsappId", isAuth, isSuper, WhatsAppController.remove);

whatsappRoutes.put("/whatsapp-admin/:whatsappId", isAuth, isSuper, WhatsAppController.updateAdmin);

whatsappRoutes.get("/whatsapp-admin/:whatsappId", isAuth, isSuper, WhatsAppController.showAdmin);

export default whatsappRoutes;
