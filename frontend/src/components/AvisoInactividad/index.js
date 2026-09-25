import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import {
  guardarLimite,
  marcarActividad,
  msRestantes,
  MS_AVISO,
  ultimaActividad,
} from "../../services/inactividadSesion";

// Cierre de sesion por inactividad: cuenta el tiempo sin actividad, avisa un
// minuto antes con una cuenta atras y cierra la sesion al llegar al limite de
// la empresa (Configuracion > Opciones). Ver services/inactividadSesion.js.

// Lo que cuenta como actividad. "scroll" no burbujea: se escucha en captura.
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"];

// Una marca cada 5 s basta con un aviso de 60: escribir en localStorage en
// cada movimiento del raton seria trabajo inutil.
const MS_ENTRE_MARCAS = 5000;

const useStyles = makeStyles((theme) => ({
  cuenta: {
    fontSize: "2.5rem",
    fontWeight: 700,
    lineHeight: 1.1,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    color: theme.palette.tokens.brand.onSurface,
    margin: theme.spacing(1, 0, 1.5),
  },
  mensaje: {
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
  acciones: {
    padding: theme.spacing(0, 3, 2),
  },
}));

const formatoCuenta = (segundos) =>
  `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

const AvisoInactividad = () => {
  const classes = useStyles();
  const { user, socket, cerrarSesionPorInactividad } = useContext(AuthContext);
  // null = sin aviso; un numero = segundos que faltan para el cierre.
  const [segundos, setSegundos] = useState(null);

  const avisoVisibleRef = useRef(false);
  const ultimaMarcaRef = useRef(0);
  // El reloj vive en un efecto sin dependencias: lee siempre la ultima
  // version de la funcion de cierre a traves de la referencia.
  const cerrarRef = useRef(cerrarSesionPorInactividad);
  cerrarRef.current = cerrarSesionPorInactividad;

  // Limite de la empresa.
  useEffect(() => {
    if (!user?.companyId) return undefined;
    let vigente = true;
    api
      .get("/session-settings")
      .then(({ data }) => {
        if (vigente) guardarLimite(data?.inactivityMinutes);
      })
      // Sin respuesta se sigue con el ultimo limite conocido (o 5 h).
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [user?.companyId]);

  // Si el administrador cambia el limite, las sesiones abiertas lo toman sin
  // recargar.
  useEffect(() => {
    if (!socket || !user?.companyId || typeof socket.on !== "function") return undefined;
    const evento = `company-${user.companyId}-sessionSettings`;
    const alCambiar = (data) => guardarLimite(data?.inactivityMinutes);
    socket.on(evento, alCambiar);
    return () => {
      if (typeof socket.off === "function") socket.off(evento, alCambiar);
    };
  }, [socket, user?.companyId]);

  // Actividad del usuario.
  useEffect(() => {
    if (!ultimaActividad()) marcarActividad();

    const alActuar = () => {
      // Con el aviso abierto no basta con mover el raton: hay que confirmar
      // con el boton. Si no, el aviso se cerraria solo al pasar por encima.
      if (avisoVisibleRef.current) return;
      const ahora = Date.now();
      if (ahora - ultimaMarcaRef.current < MS_ENTRE_MARCAS) return;
      ultimaMarcaRef.current = ahora;
      marcarActividad(ahora);
    };

    const opciones = { passive: true, capture: true };
    EVENTOS_ACTIVIDAD.forEach((e) => window.addEventListener(e, alActuar, opciones));
    return () => {
      EVENTOS_ACTIVIDAD.forEach((e) => window.removeEventListener(e, alActuar, opciones));
    };
  }, []);

  // Reloj. Una vez por segundo: lee la ultima actividad de localStorage, asi
  // que la actividad de otra pestana tambien cierra este aviso. En pestanas en
  // segundo plano el navegador ralentiza el intervalo; al volver a la pestana
  // (visibilitychange) se revisa en el acto, y tambien al despertar el equipo.
  useEffect(() => {
    const revisar = () => {
      const resta = msRestantes();
      if (resta <= 0) {
        avisoVisibleRef.current = false;
        setSegundos(null);
        cerrarRef.current();
        return;
      }
      if (resta <= MS_AVISO) {
        avisoVisibleRef.current = true;
        setSegundos(Math.ceil(resta / 1000));
      } else {
        avisoVisibleRef.current = false;
        setSegundos(null);
      }
    };

    revisar();
    const intervalo = setInterval(revisar, 1000);
    const alVolver = () => {
      if (document.visibilityState === "visible") revisar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const seguirConectado = () => {
    const ahora = Date.now();
    ultimaMarcaRef.current = ahora;
    marcarActividad(ahora);
    avisoVisibleRef.current = false;
    setSegundos(null);
  };

  const visible = segundos !== null;

  return (
    <Dialog
      open={visible}
      onClose={seguirConectado}
      maxWidth="xs"
      fullWidth
      aria-labelledby="aviso-inactividad-titulo"
      aria-describedby="aviso-inactividad-mensaje"
    >
      <DialogTitle id="aviso-inactividad-titulo">
        {i18n.t("auth.inactivity.title")}
      </DialogTitle>
      <DialogContent>
        <Typography className={classes.cuenta}>
          {visible ? formatoCuenta(segundos) : ""}
        </Typography>
        <Typography
          id="aviso-inactividad-mensaje"
          variant="body2"
          color="textSecondary"
          className={classes.mensaje}
        >
          {i18n.t("auth.inactivity.message")}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={visible ? (segundos * 1000 * 100) / MS_AVISO : 0}
        />
      </DialogContent>
      <DialogActions className={classes.acciones}>
        <Button onClick={() => cerrarRef.current()}>
          {i18n.t("auth.inactivity.logoutNow")}
        </Button>
        <Button onClick={seguirConectado} color="primary" variant="contained" autoFocus>
          {i18n.t("auth.inactivity.stay")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvisoInactividad;
