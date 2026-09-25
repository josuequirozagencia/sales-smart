import { CookieOptions, Response } from "express";

// Vida de la cookie: la misma que la del token de renovacion (authConfig
// refreshExpiresIn = "7d"). Cada renovacion la vuelve a emitir, asi que es
// deslizante.
const VIDA_COOKIE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Opciones de la cookie "jrt" (token de renovacion).
 *
 * En produccion el frontend y el backend viven en dominios distintos de
 * up.railway.app, y up.railway.app esta en la Public Suffix List: para el
 * navegador son SITIOS distintos. Con las opciones de antes (solo httpOnly,
 * que el navegador trata como SameSite=Lax) la cookie no viajaba en el
 * POST /auth/refresh_token del frontend: cada recarga de pagina, y cada vez
 * que caducaba el token de acceso (15 min), acababa en el login.
 *
 * Con el backend en https se marca SameSite=None, que exige Secure, y
 * Partitioned (CHIPS): la cookie queda ligada al sitio del frontend, que es
 * justo el uso que tiene. Safari bloquea las cookies de terceros que no lleven
 * esa marca; con ella las acepta desde la version 18.4.
 *
 * En local (http://localhost) frontend y backend son el mismo sitio y se
 * mantiene el comportamiento de siempre: Secure no se puede exigir sin https.
 *
 * Sin maxAge a proposito: clearCookie tiene que recibir las mismas opciones
 * para borrar la cookie (Partitioned incluido), y un maxAge ahi anularia el
 * borrado.
 */
export const opcionesCookieSesion = (): CookieOptions => {
  const conHttps = String(process.env.BACKEND_URL || "").startsWith("https://");

  if (conHttps) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/"
    };
  }

  return { httpOnly: true, sameSite: "lax", path: "/" };
};

export const SendRefreshToken = (res: Response, token: string): void => {
  // Con maxAge deja de ser una cookie "de sesion del navegador": en el movil
  // el navegador la descartaba al cerrarse y habia que volver a entrar. El
  // cierre por inactividad lo aplica el frontend.
  res.cookie("jrt", token, { ...opcionesCookieSesion(), maxAge: VIDA_COOKIE_MS });
};

export const ClearRefreshToken = (res: Response): void => {
  res.clearCookie("jrt", opcionesCookieSesion());
};
