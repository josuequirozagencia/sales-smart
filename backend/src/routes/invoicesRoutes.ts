import express from "express";
import isAuth from "../middleware/isAuth";
import * as QueueOptionController from "../controllers/QueueOptionController";
import * as InvoicesController from "../controllers/InvoicesController"

const invoiceRoutes = express.Router();

invoiceRoutes.get("/invoices", isAuth, InvoicesController.index);
// Le faltaba isAuth. Como el controlador saca la empresa de req.user, sin
// sesion llegaba undefined, y el servicio trataba esa ausencia como "sin
// filtro": la ruta devolvia las facturas de TODAS las empresas —importe,
// vencimiento, plan y limites contratados de cada cliente— a quien tuviera
// la URL. Es un duplicado de /invoices/all, que si estaba protegida.
invoiceRoutes.get("/invoices/list", isAuth, InvoicesController.list);
invoiceRoutes.get("/invoices/all", isAuth, InvoicesController.list);
invoiceRoutes.get("/invoices/:Invoiceid", isAuth, InvoicesController.show);
invoiceRoutes.put("/invoices/:id", isAuth, InvoicesController.update);

export default invoiceRoutes;
