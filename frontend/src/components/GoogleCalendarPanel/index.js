import React, { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";

import { Button, Paper, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import LinkOffIcon from "@material-ui/icons/LinkOff";
import SyncIcon from "@material-ui/icons/Sync";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";

/**
 * Conexion con Google Calendar, dentro de la pantalla de Conexiones.
 *
 * NO pide usuario ni contraseña de Google, y no es una carencia: OAuth
 * existe para que una aplicacion de terceros nunca los vea. El boton lleva
 * a Google, el usuario se identifica alli y autoriza solo el calendario.
 */

const useStyles = makeStyles(theme => ({
  panel: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.tokens.border.border}`,
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  titulo: { fontWeight: 600 },
  cuerpo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  estado: { color: theme.palette.text.secondary, fontSize: "0.875rem" },
  conectado: {
    color: theme.palette.tokens.semantic.success.text,
    fontWeight: 600,
  },
  // Cuando faltan las credenciales del servidor no se ofrece un boton que
  // fallaria: se explica que hay que crearlas.
  faltaConfig: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
    color: theme.palette.tokens.semantic.warning.text,
    fontSize: "0.75rem",
  },
}));

const GoogleCalendarPanel = () => {
  const classes = useStyles();
  const location = useLocation();
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const [estado, setEstado] = useState({
    configured: false,
    connected: false,
    email: null,
  });
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const esAdmin = user?.profile === "admin";

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/google/status");
      setEstado(data);
    } catch (err) {
      // Un fallo al consultar el estado no debe llenar la pantalla de
      // avisos: el panel simplemente se muestra como desconectado.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Google devuelve al navegador aqui con ?google=ok o ?google=error.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resultado = params.get("google");
    if (!resultado) return;

    if (resultado === "ok") {
      toast.success(i18n.t("googleCalendar.toasts.connected"));
      cargar();
    } else {
      toast.error(i18n.t("googleCalendar.toasts.failed"));
    }
    // Se limpia la URL para que recargar no repita el aviso.
    history.replace(location.pathname);
  }, [location, history, cargar]);

  const conectar = async () => {
    try {
      const { data } = await api.get("/google/auth-url");
      // Se sale del CRM a proposito: la identificacion ocurre en Google,
      // no aqui.
      window.location.href = data.url;
    } catch (err) {
      toastError(err);
    }
  };

  // La sincronizacion corre sola cada cinco minutos. Este boton existe
  // para no tener que esperar a la siguiente pasada cuando acabas de
  // cambiar algo en Google.
  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data } = await api.post("/google/sync");
      toast.success(
        i18n.t("googleCalendar.toasts.synced", {
          nuevas: data.creadas,
          actualizadas: data.actualizadas,
          canceladas: data.canceladas,
        })
      );
      await cargar();
    } catch (err) {
      toastError(err);
    } finally {
      setSincronizando(false);
    }
  };

  const desconectar = async () => {
    try {
      await api.delete("/google/disconnect");
      toast.success(i18n.t("googleCalendar.toasts.disconnected"));
      await cargar();
    } catch (err) {
      toastError(err);
    } finally {
      setConfirmar(false);
    }
  };

  if (cargando) return null;

  return (
    <Paper variant="outlined" className={classes.panel}>
      <div className={classes.cabecera}>
        <EventAvailableIcon fontSize="small" />
        <span className={classes.titulo}>{i18n.t("googleCalendar.title")}</span>
      </div>

      <div className={classes.cuerpo}>
        <div>
          {estado.connected ? (
            <span>
              <span className={classes.conectado}>
                {i18n.t("googleCalendar.connectedAs")} {estado.email}
              </span>
              {estado.lastSyncAt && (
                <span className={classes.estado} style={{ display: "block" }}>
                  {i18n.t("googleCalendar.lastSync")}{" "}
                  {new Date(estado.lastSyncAt).toLocaleString()}
                </span>
              )}
            </span>
          ) : (
            <span className={classes.estado}>
              {i18n.t("googleCalendar.description")}
            </span>
          )}
        </div>

        {esAdmin && estado.configured && (
          estado.connected ? (
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<SyncIcon />}
                onClick={sincronizar}
                disabled={sincronizando}
              >
                {i18n.t("googleCalendar.buttons.sync")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkOffIcon />}
                onClick={() => setConfirmar(true)}
              >
                {i18n.t("googleCalendar.buttons.disconnect")}
              </Button>
            </span>
          ) : (
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={conectar}
            >
              {i18n.t("googleCalendar.buttons.connect")}
            </Button>
          )
        )}
      </div>

      {!estado.configured && (
        <div className={classes.faltaConfig}>
          {i18n.t("googleCalendar.notConfigured")}
        </div>
      )}

      {estado.configured && !esAdmin && (
        <div className={classes.estado} style={{ marginTop: 8 }}>
          {i18n.t("googleCalendar.adminOnly")}
        </div>
      )}

      <ConfirmationModal
        title={i18n.t("googleCalendar.confirmDisconnect.title")}
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={desconectar}
      >
        {i18n.t("googleCalendar.confirmDisconnect.message")}
      </ConfirmationModal>
    </Paper>
  );
};

export default GoogleCalendarPanel;
