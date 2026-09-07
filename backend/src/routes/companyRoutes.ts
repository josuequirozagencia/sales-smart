import express from "express";
import isAuth from "../middleware/isAuth";

import * as CompanyController from "../controllers/CompanyController";

const companyRoutes = express.Router();

companyRoutes.get("/companies/list", isAuth, CompanyController.list);
companyRoutes.get("/companies", isAuth, CompanyController.index);
companyRoutes.get("/companies/:id", isAuth, CompanyController.show);
companyRoutes.post("/companies", isAuth, CompanyController.store);
companyRoutes.put("/companies/:id", isAuth, CompanyController.update);

// Revision de la solicitud. Antes de la ruta de horarios para que el
// orden no importe, y separada de update porque son decisiones distintas:
// una edita datos, la otra concede o retira el acceso.
companyRoutes.put("/companies/:id/review", isAuth, CompanyController.review);

// Historial de la solicitud. GET aparte y no dentro de show, para no
// cargar la auditoria en cada listado de empresas.
companyRoutes.get("/companies/:id/audit", isAuth, CompanyController.audit);
companyRoutes.put("/companies/:id/schedules",isAuth,CompanyController.updateSchedules);
companyRoutes.delete("/companies/:id", isAuth, CompanyController.remove);

// Rota para listar o plano da empresa
companyRoutes.get("/companies/listPlan/:id", isAuth, CompanyController.listPlan);
companyRoutes.get("/companiesPlan", isAuth, CompanyController.indexPlan);

export default companyRoutes;
