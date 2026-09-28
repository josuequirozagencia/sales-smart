import React, { useContext, useEffect, useMemo, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import AccessTimeIcon from "@material-ui/icons/AccessTime";

import { AuthContext } from "../../context/Auth/AuthContext";
import SelectorPlanes from "../SelectorPlanes";
import { i18n } from "../../translate/i18n";

/**
 * El dia UTC de una fecha.
 *
 * Se cuenta por dia natural en UTC porque es exactamente lo que hacen el
 * backend y el control de acceso. Contarlo de otra manera abriria un dia en
 * el que el banner y el acceso dirian cosas distintas.
 */
const diaUTC = valor => {
  if (!valor) return null;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
};

/**
 * Dias naturales que le quedan a la prueba.
 *
 * 7..1 quedan por delante, 0 es "termina hoy" y negativo es terminada.
 * Devuelve null si no hay fecha, que significa "no se sabe", nunca
 * "se acabo".
 */
export const diasDePruebaRestantes = (trialEndsAt, ahora = new Date()) => {
  const fin = diaUTC(trialEndsAt);
  const hoy = diaUTC(ahora);

  if (!fin || !hoy) return null;

  const unDia = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / unDia
  );
};

const useStyles = makeStyles(theme => ({
  banner: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    margin: theme.spacing(0, 0, 1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.primary.main}33`,
    background:
      theme.palette.type === "dark"
        ? `linear-gradient(90deg, ${theme.palette.primary.dark}40, transparent)`
        : `linear-gradient(90deg, ${theme.palette.primary.light}26, transparent)`,
    // Sin ancho fijo y con envoltura: en movil las tres partes se apilan y
    // no aparece barra horizontal.
    maxWidth: "100%",
    boxSizing: "border-box"
  },
  bannerVencido: {
    border: `1px solid ${theme.palette.error.main}55`,
    background:
      theme.palette.type === "dark"
        ? `linear-gradient(90deg, ${theme.palette.error.dark}33, transparent)`
        : `linear-gradient(90deg, ${theme.palette.error.light}26, transparent)`
  },
  icono: {
    color: theme.palette.primary.main,
    flexShrink: 0
  },
  iconoVencido: {
    color: theme.palette.error.main
  },
  textos: {
    // Crece y puede encogerse: sin el minWidth a cero un texto largo
    // ensancharia el contenedor en pantallas estrechas.
    flex: "1 1 240px",
    minWidth: 0
  },
  titulo: {
    fontWeight: 600,
    lineHeight: 1.3
  },
  subtitulo: {
    opacity: 0.75
  },
  accion: {
    flexShrink: 0,
    fontWeight: 600,
    borderRadius: 8,
    textTransform: "none",
    paddingInline: theme.spacing(2.5)
  }
}));

/**
 * Aviso de prueba gratuita, con los dias que quedan y el acceso a los planes.
 *
 * Se apoya en trialEndsAt y subscriptionStatus, que vienen del backend con
 * el usuario. El numero de dias NO esta escrito en ninguna parte: se calcula
 * con la fecha real, y se vuelve a calcular cada minuto para que el contador
 * no se quede parado si alguien deja la pestana abierta toda la noche.
 *
 * Este aviso es informativo. Quien decide de verdad es el backend: aqui solo
 * se pinta lo que el ya determino.
 */
const BannerPrueba = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [abierto, setAbierto] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(reloj);
  }, []);

  const estado = user?.company?.subscriptionStatus;
  const finDePrueba = user?.company?.trialEndsAt;

  const dias = useMemo(
    () => diasDePruebaRestantes(finDePrueba, ahora),
    [finDePrueba, ahora]
  );

  // Las empresas anteriores a la prueba gratuita tienen estos campos nulos:
  // no les corresponde este aviso y siguen exactamente como estaban.
  const enPrueba = estado === "trial" && dias !== null && dias >= 0;
  const terminada = estado === "expired" || (estado === "trial" && dias < 0);

  if (!enPrueba && !terminada) return null;

  let titulo;
  if (terminada) {
    titulo = i18n.t("banner.prueba.terminada");
  } else if (dias === 0) {
    titulo = i18n.t("banner.prueba.hoy");
  } else if (dias === 1) {
    titulo = i18n.t("banner.prueba.unDia");
  } else {
    titulo = i18n.t("banner.prueba.quedan", { dias });
  }

  const subtitulo = terminada
    ? i18n.t("banner.prueba.subtituloTerminada")
    : i18n.t("banner.prueba.subtitulo");

  return (
    <>
      <div
        className={`${classes.banner} ${terminada ? classes.bannerVencido : ""}`}
        role="status"
      >
        <AccessTimeIcon
          className={`${classes.icono} ${terminada ? classes.iconoVencido : ""}`}
        />

        <div className={classes.textos}>
          <Typography variant="body1" className={classes.titulo}>
            {titulo}
          </Typography>
          <Typography variant="body2" className={classes.subtitulo}>
            {subtitulo}
          </Typography>
        </div>

        <Button
          variant="contained"
          color="primary"
          disableElevation
          className={classes.accion}
          onClick={() => setAbierto(true)}
        >
          {i18n.t("banner.prueba.cta")}
        </Button>
      </div>

      <SelectorPlanes abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
};

export default BannerPrueba;
