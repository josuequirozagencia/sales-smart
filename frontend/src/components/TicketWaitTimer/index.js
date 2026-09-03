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

// El prefijo "use" no es cosmetico: es lo que permite al linter aplicar
// las reglas de hooks a esta funcion.
const useReloj = () => {
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

// Techo de la alerta: un dia.
//
// Por encima, el ticket deja de ser algo sobre lo que actuar ahora y pasa
// a ser trabajo de triaje. Si todo lo viejo se quedara en rojo, la lista se
// llenaria de alertas permanentes y el aviso perderia su unico proposito,
// que es distinguir el lead de veinticinco minutos —recuperable— del que
// lleva una semana abandonado.
const TECHO_ALERTA = 24 * 60;

const useStyles = makeStyles(theme => ({
  raiz: {
    display: "inline-block",
    fontSize: "0.6875rem",
    fontWeight: 600,
    lineHeight: 1.4,
    padding: "1px 6px",
    borderRadius: theme.palette.tokens.radius.sm,
    whiteSpace: "nowrap",
    // Un borde transparente en la base para que los cuatro niveles midan
    // igual y la lista no se descuadre al cambiar uno de estado.
    border: "1px solid transparent",
  },

  // Aun hay margen. Texto suelto, sin peso visual: no hay nada que hacer.
  tranquilo: {
    color: theme.palette.text.secondary,
  },

  // Se acerca el plazo.
  aviso: {
    color: theme.palette.tokens.semantic.warning.text,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
  },

  // Ventana accionable: el plazo ya paso y el lead esta a punto de cambiar
  // de asesor, o ya cambio.
  //
  // Relleno solido y no la pareja discreta de rojo oscuro sobre rosa: en
  // una lista con etiquetas verdes y azules saturadas al lado, el aviso
  // que mas importa era el que menos se veia. Blanco sobre este rojo da
  // 4,83.
  alerta: {
    color: theme.palette.tokens.onColor(theme.palette.tokens.semantic.error.fill),
    backgroundColor: theme.palette.tokens.semantic.error.fill,
  },

  // Mas de un dia esperando. Deja de gritar a proposito.
  //
  // Un ticket de una semana ya no es "responde ahora", es otra categoria y
  // se triaja aparte. Mantenerlo en rojo intenso agotaria el aviso y haria
  // que el de veinticinco minutos —el unico sobre el que aun se puede
  // actuar— se perdiera entre los abandonados.
  //
  // Se distingue del nivel tranquilo por el borde, no por el color: asi el
  // texto sigue siendo el secundario del tema, que ya esta medido contra
  // la superficie en los dos modos.
  estancado: {
    color: theme.palette.text.secondary,
    borderColor: theme.palette.tokens.border.border,
  },
}));

const TicketWaitTimer = ({ waitingSince, queue }) => {
  const classes = useStyles();
  const ahora = useReloj();

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
  if (minutos >= TECHO_ALERTA) {
    // Por encima del techo no se mira el umbral de la cola: pasado un dia
    // el plazo de rotacion dejo de ser la pregunta.
    nivel = "estancado";
  } else if (umbral) {
    if (minutos >= umbral) nivel = "alerta";
    else if (minutos >= umbral / 2) nivel = "aviso";
    else nivel = "tranquilo";
  } else if (minutos >= ALERTA_SIN_ROTACION) nivel = "alerta";
  else if (minutos >= AVISO_SIN_ROTACION) nivel = "aviso";
  else nivel = "tranquilo";

  // Pasado el techo no se menciona el plazo de rotacion: ya se cumplio hace
  // mucho y repetirlo confundiria mas que ayudar.
  let explicacion;
  if (nivel === "estancado") {
    explicacion = i18n.t("ticketWaitTimer.tooltipEstancado");
  } else if (umbral) {
    explicacion = i18n.t("ticketWaitTimer.tooltipRotacion", {
      minutos: String(umbral),
    });
  } else {
    explicacion = i18n.t("ticketWaitTimer.tooltip");
  }

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
