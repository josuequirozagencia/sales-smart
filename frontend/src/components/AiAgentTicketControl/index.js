import React, { useContext, useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { CircularProgress, Switch, Tooltip, Typography } from "@material-ui/core";
import clsx from "clsx";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

// Control del Agente IA en la conversacion. Activar o pausar la IA solo cambia
// si la IA responde: no toca a quien esta asignado el ticket, ni su estado, ni
// la fila. Solo aparece si la conexion del ticket tiene un agente.
//
// Es un interruptor y no un boton: el boton decia la accion ("Activar Agente
// IA") mientras la insignia de al lado decia el estado, dos cosas distintas
// compitiendo en la misma franja, y en el movil se llevaba una linea entera.
// Un interruptor dice estado y accion a la vez y cabe al final de la fila.

const useStyles = makeStyles((theme) => {
  const s = theme.palette.tokens?.semantic;
  return {
    franja: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      padding: theme.spacing(0.25, 2),
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      [theme.breakpoints.down("xs")]: {
        padding: theme.spacing(0, 1),
        gap: theme.spacing(0.5),
      },
    },
    robot: {
      fontSize: "0.9375rem",
      lineHeight: 1,
      flexShrink: 0,
    },
    // Todo el texto en una sola linea que se recorta: el nombre del agente o
    // el motivo de la pausa son datos de apoyo y no deben empujar la franja.
    texto: {
      flex: 1,
      minWidth: 0,
      color: theme.palette.text.secondary,
    },
    estado: {
      fontWeight: 700,
    },
    activo: {
      color: s?.success.text || theme.palette.success.dark,
    },
    pausado: {
      color: s?.warning.text || theme.palette.warning.dark,
    },
    aviso: {
      color: s?.warning.text || theme.palette.warning.dark,
    },
    control: {
      marginLeft: "auto",
      display: "inline-flex",
      alignItems: "center",
      gap: theme.spacing(0.5),
      flexShrink: 0,
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
  const textoEstado = estado.enabled
    ? i18n.t("aiAgentControl.active")
    : i18n.t("aiAgentControl.paused");

  return (
    <div className={classes.franja} role="region" aria-label={i18n.t("aiAgentControl.label")}>
      <span className={classes.robot} aria-hidden="true">🤖</span>

      <Typography variant="caption" className={classes.texto} noWrap aria-live="polite">
        <span
          className={clsx(classes.estado, estado.enabled ? classes.activo : classes.pausado)}
        >
          {i18n.t("aiAgentControl.label")}: {textoEstado}
        </span>
        {detalle ? ` · ${detalle}` : ""}
        {estado.enabled && disableBot && (
          <span className={classes.aviso}> · {i18n.t("aiAgentControl.disableBot")}</span>
        )}
        {estado.enabled && !disableBot && !estado.withinSchedule && (
          <span className={classes.aviso}> · {i18n.t("aiAgentControl.outOfSchedule")}</span>
        )}
      </Typography>

      <Tooltip title={i18n.t("aiAgentControl.keepsAssignment")}>
        <span className={classes.control}>
          {guardando && <CircularProgress size={14} color="inherit" />}
          <Switch
            size="small"
            color="primary"
            checked={!!estado.enabled}
            onChange={cambiar}
            disabled={guardando}
            inputProps={{
              "aria-label": `${i18n.t("aiAgentControl.label")}: ${textoEstado}`,
            }}
          />
        </span>
      </Tooltip>
    </div>
  );
};

export default AiAgentTicketControl;
