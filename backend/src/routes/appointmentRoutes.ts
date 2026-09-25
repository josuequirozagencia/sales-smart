import express from "express";
import isAuth from "../middleware/isAuth";

import * as AppointmentController from "../controllers/AppointmentController";

const appointmentRoutes = express.Router();

appointmentRoutes.get("/appointments", isAuth, AppointmentController.index);
appointmentRoutes.post("/appointments", isAuth, AppointmentController.store);
appointmentRoutes.put(
  "/appointments/:appointmentId/status",
  isAuth,
  AppointmentController.updateStatus
);

export default appointmentRoutes;
