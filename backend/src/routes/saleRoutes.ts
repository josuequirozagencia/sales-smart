import express from "express";
import isAuth from "../middleware/isAuth";

import * as SaleController from "../controllers/SaleController";

const saleRoutes = express.Router();

saleRoutes.get("/sales", isAuth, SaleController.index);
saleRoutes.post("/sales", isAuth, SaleController.store);
saleRoutes.delete("/sales/:saleId", isAuth, SaleController.remove);

export default saleRoutes;
