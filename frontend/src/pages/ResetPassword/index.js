import React, { useState } from "react";
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";

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
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Elegir la contrasena nueva.
 *
 * El token viaja en la URL. La validacion de verdad —que exista, que no
 * haya caducado y que no se haya usado— la hace el servidor: aqui solo se
 * comprueba lo que evita un viaje inutil.
 */

const LONGITUD_MINIMA = 8;

const useStyles = makeStyles(theme => ({
  fondo: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    backgroundColor: theme.palette.tokens.surface.background,
  },
  tarjeta: {
    padding: theme.spacing(4),
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.tokens.border.border}`,
  },
  titulo: { fontWeight: 700, marginBottom: theme.spacing(2) },
  campo: { marginBottom: theme.spacing(2) },
  boton: { marginTop: theme.spacing(1), marginBottom: theme.spacing(2) },
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

const ResetPassword = () => {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();

  const token = new URLSearchParams(location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cortaDemas = password.length > 0 && password.length < LONGITUD_MINIMA;
  const noCoinciden = confirmar.length > 0 && password !== confirmar;
  const puedeEnviar =
    password.length >= LONGITUD_MINIMA && password === confirmar && !!token;

  const guardar = async e => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.post("/reset-password", { token, password });
      toast.success(i18n.t("resetPassword.done"));
      history.push("/login");
    } catch (err) {
      // El servidor devuelve el mismo error para token inexistente, usado o
      // caducado. Se traduce a un mensaje que dice que hacer, no cual de
      // los tres casos fue.
      toast.error(i18n.t("resetPassword.invalidLink"));
    } finally {
      setGuardando(false);
    }
  };

  // Sin token en la URL no hay nada que hacer: se dice y se ofrece salida.
  if (!token) {
    return (
      <div className={classes.fondo}>
        <CssBaseline />
        <Container component="main" maxWidth="xs">
          <Paper className={classes.tarjeta} elevation={0}>
            <Typography variant="h6" className={classes.titulo}>
              {i18n.t("resetPassword.title")}
            </Typography>
            <div className={classes.error}>
              {i18n.t("resetPassword.invalidLink")}
            </div>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => history.push("/forgot-password")}
            >
              {i18n.t("resetPassword.requestNew")}
            </Button>
          </Paper>
        </Container>
      </div>
    );
  }

  return (
    <div className={classes.fondo}>
      <CssBaseline />
      <Container component="main" maxWidth="xs">
        <Paper className={classes.tarjeta} elevation={0}>
          <Typography variant="h6" className={classes.titulo}>
            {i18n.t("resetPassword.title")}
          </Typography>

          <form onSubmit={guardar}>
            <TextField
              className={classes.campo}
              variant="outlined"
              fullWidth
              required
              autoFocus
              type="password"
              label={i18n.t("resetPassword.newPassword")}
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={cortaDemas}
              helperText={
                cortaDemas ? i18n.t("resetPassword.tooShort") : " "
              }
            />

            <TextField
              className={classes.campo}
              variant="outlined"
              fullWidth
              required
              type="password"
              label={i18n.t("resetPassword.confirmPassword")}
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              error={noCoinciden}
              helperText={
                noCoinciden ? i18n.t("resetPassword.mismatch") : " "
              }
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.boton}
              disabled={guardando || !puedeEnviar}
            >
              {i18n.t("resetPassword.submit")}
            </Button>

            <Link
              component={RouterLink}
              to="/login"
              variant="body2"
              className={classes.volver}
            >
              {i18n.t("resetPassword.backToLogin")}
            </Link>
          </form>
        </Paper>
      </Container>
    </div>
  );
};

export default ResetPassword;
