import express from "express";
import isAuth from "../middleware/isAuth";
import * as UserController from "../controllers/UserController";
import * as SessionController from "../controllers/SessionController";

const authRoutes = express.Router();

authRoutes.post("/signup", UserController.store);
authRoutes.post("/login", SessionController.store);
authRoutes.post("/refresh_token", SessionController.update);

// Sin isAuth a proposito: quien ha perdido la contrasena no tiene sesion.
authRoutes.post("/forgot-password", SessionController.forgotPassword);
authRoutes.post("/reset-password", SessionController.resetPassword);
authRoutes.delete("/logout", isAuth, SessionController.remove);
authRoutes.get("/me", isAuth, SessionController.me);
authRoutes.post("/validate-cnpj", UserController.validateCnpj);

export default authRoutes;
