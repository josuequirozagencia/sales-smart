import React, { useEffect, useState } from "react";
import { Tooltip, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

/**
 * Contador de espera del cliente.
 *
 * Muestra cuánto lleva el cliente esperando respuesta humana, y avisa por
 * color cuando se acerca al plazo con el que la rotación automática le
 * quita el lead al asesor.
 *
 * El servidor manda el INSTANTE en que empezó la espera (waitingSince), no
 * una duración: así el número avanza solo en pantalla sin volver a
 * preguntar nada. El cálculo de qué cuenta como respuesta —descartando el
 * bot y las notas internas— vive en el backend, en TicketWaitTimeService,
 * junto al de la rotación y al del reporte, para que los tres no puedan
 * discrepar.
 */

// ---------------------------------------------------------------------------
// Reloj compartido
//
// Una lista puede tener cuarenta tickets. Con un setInterval por fila serían
// cuarenta temporizadores haciendo lo mismo, así que hay uno solo y las filas
// se suscriben. Cuando no queda ninguna, se apaga.
// ---------------------------------------------------------------------------
const suscriptores = new Set();
let intervalo = null;

// Medio minuto: el contador se muestra en minutos, así que afinar más solo
// gastaría repintados que nadie ve.
const CADENCIA_MS = 30000;

const usarReloj = () => {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const avisar = () => setAhora(Date.now());
    suscriptores.add(avisar);

    if (!intervalo) {
      intervalo = setInterval(() => suscriptores.forEach(f => f()), CADENCIA_MS);
    }

    return () => {
      suscriptores.delete(avisar);
      if (suscriptores.size === 0) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
  }, []);

  return ahora;
};

// ---------------------------------------------------------------------------

/** Minutos a un texto corto: "14 min", "2 h 5", "3 d". */
const formatear = minutos => {
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto ? `${horas} h ${resto}` : `${horas} h`;
  }

  return `${Math.floor(horas / 24)} d`;
};

// Umbrales de color cuando la cola NO tiene rotación activa y por tanto no
// hay plazo real contra el que avisar. Son una referencia de atención, no
// una regla del sistema.
const AVISO_SIN_ROTACION = 15;
const ALERTA_SIN_ROTACION = 30;

const useStyles = makeStyles(theme => ({
  raiz: {
    display: "inline-block",
    fontSize: "0.6875rem",
    fontWeight: 600,
    lineHeight: 1.4,
    padding: "1px 6px",
    borderRadius: theme.palette.tokens.radius.sm,
    whiteSpace: "nowrap",
  },
  tranquilo: {
    color: theme.palette.text.secondary,
  },
  aviso: {
    color: theme.palette.tokens.semantic.warning.text,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
  },
  alerta: {
    color: theme.palette.tokens.semantic.error.text,
    backgroundColor: theme.palette.tokens.semantic.error.soft,
  },
}));

const TicketWaitTimer = ({ waitingSince, queue }) => {
  const classes = useStyles();
  const ahora = usarReloj();

  // Sin fecha no hay espera que contar: o nunca escribió el cliente, o ya
  // se le contestó. Es el caso normal, no un error.
  if (!waitingSince) return null;

  const inicio = new Date(waitingSince);
  if (Number.isNaN(inicio.getTime())) return null;

  const minutos = Math.floor((ahora - inicio.getTime()) / 60000);

  // Por debajo de un minuto el número no aporta nada y parpadearía.
  if (minutos < 1) return null;

  // El plazo real es el de la cola, si tiene la rotación encendida.
  const umbral =
    queue && queue.ativarRoteador && Number(queue.tempoRoteador) > 0
      ? Number(queue.tempoRoteador)
      : null;

  let nivel;
  if (umbral) {
    if (minutos >= umbral) nivel = "alerta";
    else if (minutos >= umbral / 2) nivel = "aviso";
    else nivel = "tranquilo";
  } else if (minutos >= ALERTA_SIN_ROTACION) nivel = "alerta";
  else if (minutos >= AVISO_SIN_ROTACION) nivel = "aviso";
  else nivel = "tranquilo";

  const explicacion = umbral
    ? i18n.t("ticketWaitTimer.tooltipRotacion", {
        minutos: String(umbral),
      })
    : i18n.t("ticketWaitTimer.tooltip");

  return (
    <Tooltip title={explicacion} arrow>
      <Typography
        component="span"
        className={`${classes.raiz} ${classes[nivel]}`}
      >
        {formatear(minutos)}
      </Typography>
    </Tooltip>
  );
};

export default TicketWaitTimer;
