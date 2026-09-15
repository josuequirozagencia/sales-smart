import React, { useContext, useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Button, CircularProgress, Tooltip, Typography } from "@material-ui/core";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

// Control del Agente IA en la conversacion. Activar o pausar la IA solo cambia
// si la IA responde: no toca a quien esta asignado el ticket, ni su estado, ni
// la fila. Solo aparece si la conexion del ticket tiene un agente.

const useStyles = makeStyles((theme) => {
  const s = theme.palette.tokens?.semantic;
  return {
    franja: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      padding: theme.spacing(0.75, 2),
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
    },
    estado: {
      display: "inline-flex",
      alignItems: "center",
      gap: theme.spacing(0.75),
      padding: theme.spacing(0.25, 1),
      borderRadius: 999,
      fontWeight: 600,
      fontSize: "0.8125rem",
      whiteSpace: "nowrap",
    },
    activo: {
      color: s?.success.text || theme.palette.success.dark,
      backgroundColor: s?.success.soft || theme.palette.success.light,
    },
    pausado: {
      color: s?.warning.text || theme.palette.warning.dark,
      backgroundColor: s?.warning.soft || theme.palette.warning.light,
    },
    detalle: {
      flex: "1 1 180px",
      minWidth: 0,
      color: theme.palette.text.secondary,
    },
    aviso: {
      color: s?.warning.text || theme.palette.warning.dark,
    },
    boton: {
      marginLeft: "auto",
      whiteSpace: "nowrap",
    },
  };
});

const AiAgentTicketControl = ({ ticket, contact }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const ticketId = ticket?.id;
  const cerrado = ticket?.status === "closed";

  useEffect(() => {
    setEstado(null);
    if (!ticketId || cerrado) return undefined;
    let vigente = true;
    api
      .get(`/ai-agents/tickets/${ticketId}/state`)
      .then(({ data }) => vigente && setEstado(data))
      // Sin agente o sin permiso simplemente no se muestra el control.
      .catch(() => vigente && setEstado(null));
    return () => {
      vigente = false;
    };
  }, [ticketId, ticket?.whatsappId, cerrado]);

  useEffect(() => {
    if (!socket || !user?.companyId || !ticketId) return undefined;
    const evento = `company-${user.companyId}-aiAgentTicketState`;
    const alCambiar = (data) => {
      if (data?.state?.ticketId !== ticketId) return;
      setEstado((previo) => (previo ? { ...previo, ...data.state } : previo));
    };
    socket.on(evento, alCambiar);
    return () => socket.off(evento, alCambiar);
  }, [socket, user?.companyId, ticketId]);

  if (!estado?.available || cerrado) return null;

  const cambiar = async () => {
    setGuardando(true);
    try {
      const { data } = await api.put(`/ai-agents/tickets/${ticketId}/state`, { enabled: !estado.enabled });
      setEstado(data);
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const disableBot = contact?.disableBot ?? estado.disableBot;
  const detalle = !estado.enabled && estado.reason
    ? i18n.t(`aiAgentControl.reasons.${estado.reason}`)
    : estado.agentName;

  return (
    <div className={classes.franja} role="region" aria-label={i18n.t("aiAgentControl.label")}>
      <span
        className={`${classes.estado} ${estado.enabled ? classes.activo : classes.pausado}`}
        aria-live="polite"
      >
        <span aria-hidden="true">🤖</span>
        {i18n.t("aiAgentControl.label")}: {estado.enabled ? i18n.t("aiAgentControl.active") : i18n.t("aiAgentControl.paused")}
      </span>

      <Typography variant="caption" className={classes.detalle} noWrap>
        {detalle}
        {estado.enabled && disableBot && (
          <span className={classes.aviso}> · {i18n.t("aiAgentControl.disableBot")}</span>
        )}
        {estado.enabled && !disableBot && !estado.withinSchedule && (
          <span className={classes.aviso}> · {i18n.t("aiAgentControl.outOfSchedule")}</span>
        )}
      </Typography>

      <Tooltip title={i18n.t("aiAgentControl.keepsAssignment")}>
        <span className={classes.boton}>
          <Button
            size="small"
            variant={estado.enabled ? "outlined" : "contained"}
            color="primary"
            disabled={guardando}
            onClick={cambiar}
            startIcon={guardando ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {estado.enabled ? i18n.t("aiAgentControl.pause") : i18n.t("aiAgentControl.activate")}
          </Button>
        </span>
      </Tooltip>
    </div>
  );
};

export default AiAgentTicketControl;
