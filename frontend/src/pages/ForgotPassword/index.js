import React, { useState } from "react";
import { Link as RouterLink, useHistory } from "react-router-dom";

import {
  Button,
  Container,
  CssBaseline,
  Link,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Solicitar el enlace de recuperacion.
 *
 * Se responde SIEMPRE el mismo mensaje, exista o no la cuenta. Decir "ese
 * correo no esta registrado" convertiria esta pantalla en una herramienta
 * para averiguar quien tiene cuenta en el sistema, que es el primer paso de
 * cualquier ataque dirigido.
 */

const useStyles = makeStyles(theme => ({
  fondo: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    boxSizing: "border-box",
    backgroundColor: theme.palette.tokens.surface.background,
  },
  tarjeta: {
    padding: theme.spacing(4),
    width: "100%",
    maxWidth: 420,
    margin: "0 auto",
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.tokens.border.border}`,
  },
  titulo: { fontWeight: 700, marginBottom: theme.spacing(1) },
  explicacion: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
  },
  boton: { marginTop: theme.spacing(2), marginBottom: theme.spacing(2) },
  aviso: {
    padding: theme.spacing(2),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.semantic.success.soft,
    color: theme.palette.tokens.semantic.success.text,
    marginBottom: theme.spacing(2),
    fontSize: "0.875rem",
  },
  error: {
    padding: theme.spacing(2),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.semantic.error.soft,
    color: theme.palette.tokens.semantic.error.text,
    marginBottom: theme.spacing(2),
    fontSize: "0.875rem",
  },
  volver: { display: "block", textAlign: "center" },
}));

const ForgotPassword = () => {
  const classes = useStyles();
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Fallo TECNICO, distinto de que la cuenta no exista.
  const [averiado, setAveriado] = useState(false);

  const enviar = async e => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch (err) {
      // Que la cuenta exista o no NUNCA se distingue: eso convertiria la
      // pantalla en una forma de averiguar quien tiene cuenta.
      //
      // Pero un fallo de TRANSPORTE si se cuenta, y no filtra nada: que
      // el servidor no conteste, o que la ruta no exista, no depende de
      // ninguna cuenta. Callarlo tambien aqui fue justamente lo que
      // escondio durante una fase entera que esta pantalla llamaba a una
      // ruta equivocada: se decia <enviado> sin haber enviado nada.
      // El 401 entra en la lista a proposito: esta aplicacion responde 401
      // a las rutas que NO existen, no solo a las que exigen sesion. Y esta
      // ruta, cuando existe, contesta 200 siempre. Asi que aqui un 401 solo
      // puede significar que la peticion no llego a su sitio.
      const estado = err?.response?.status;
      if (!err?.response || [401, 404, 405].includes(estado)) {
        setAveriado(true);
        return;
      }
    } finally {
      setEnviando(false);
    }
    setEnviado(true);
  };

  return (
    <div className={classes.fondo}>
      <CssBaseline />
      <Container component="main" maxWidth="xs">
        <Paper className={classes.tarjeta} elevation={0}>
          <Typography variant="h6" className={classes.titulo}>
            {i18n.t("forgotPassword.title")}
          </Typography>

          {averiado && (
            <div className={classes.error}>
              {i18n.t("forgotPassword.technicalError")}
            </div>
          )}

          {enviado ? (
            <>
              <div className={classes.aviso}>
                {i18n.t("forgotPassword.sent")}
              </div>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => history.push("/login")}
              >
                {i18n.t("forgotPassword.backToLogin")}
              </Button>
            </>
          ) : (
            <form onSubmit={enviar}>
              <Typography variant="body2" className={classes.explicacion}>
                {i18n.t("forgotPassword.help")}
              </Typography>

              <TextField
                variant="outlined"
                fullWidth
                required
                autoFocus
                type="email"
                label={i18n.t("forgotPassword.email")}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.boton}
                disabled={enviando || !email.trim()}
              >
                {i18n.t("forgotPassword.submit")}
              </Button>

              <Link
                component={RouterLink}
                to="/login"
                variant="body2"
                className={classes.volver}
              >
                {i18n.t("forgotPassword.backToLogin")}
              </Link>
            </form>
          )}
        </Paper>
      </Container>
    </div>
  );
};

export default ForgotPassword;
