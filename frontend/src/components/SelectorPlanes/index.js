import React, { useContext, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import usePlans from "../../hooks/usePlans";

const useStyles = makeStyles(theme => ({
  intro: {
    marginBottom: theme.spacing(3),
    opacity: 0.75
  },
  rejilla: {
    display: "grid",
    // Las tarjetas se recolocan solas: tres en escritorio, una en movil,
    // sin consultas de medios y sin desbordar a lo ancho.
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: theme.spacing(2)
  },
  tarjeta: {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    transition: "border-color .15s ease, transform .15s ease",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)"
    }
  },
  tarjetaActual: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2
  },
  nombre: {
    fontWeight: 700,
    letterSpacing: 0.4
  },
  precio: {
    fontWeight: 700,
    lineHeight: 1.1,
    margin: theme.spacing(1, 0, 0)
  },
  periodicidad: {
    opacity: 0.65,
    marginBottom: theme.spacing(2)
  },
  caracteristicas: {
    listStyle: "none",
    margin: theme.spacing(0, 0, 3),
    padding: 0,
    // Empuja el boton al fondo para que todas las tarjetas lo alineen.
    flexGrow: 1
  },
  caracteristica: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.4, 0),
    fontSize: "0.875rem"
  },
  tic: {
    fontSize: 18,
    color: theme.palette.primary.main,
    flexShrink: 0
  },
  elegir: {
    textTransform: "none",
    fontWeight: 600,
    borderRadius: 8
  },
  vacio: {
    padding: theme.spacing(4, 0),
    textAlign: "center",
    opacity: 0.7
  },
  cargando: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(5, 0)
  }
}));

/**
 * Selector de planes.
 *
 * Los planes se piden al backend y nunca se escriben aqui: nombre, precio y
 * limites salen de la tabla Plans. Si manana cambia un precio, esta pantalla
 * lo refleja sin tocarla.
 *
 * Al elegir se manda UNICAMENTE el identificador del plan. El precio, las
 * fechas y el estado de la suscripcion los decide el backend; si viajaran
 * desde aqui, cualquiera podria contratar el plan caro al precio del barato.
 */
const SelectorPlanes = ({ abierto, onCerrar }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { getPlanList } = usePlans();

  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [contratando, setContratando] = useState(null);

  useEffect(() => {
    if (!abierto) return undefined;

    let vigente = true;
    setCargando(true);

    (async () => {
      try {
        // El endpoint publico devuelve solo los planes ofrecidos.
        const lista = await getPlanList();
        if (vigente) setPlanes(Array.isArray(lista) ? lista : []);
      } catch (err) {
        if (vigente) toastError(err);
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const contratar = async plan => {
    setContratando(plan.id);

    try {
      await api.post("/companies/subscription", { planId: plan.id });

      // Recarga completa a proposito: el plan decide limites, menu y
      // funciones en media aplicacion, y contratar es una accion unica.
      // Mas barato y mas fiable que repartir el estado nuevo a mano.
      window.location.reload();
    } catch (err) {
      toastError(err);
      setContratando(null);
    }
  };

  const caracteristicasDe = plan => {
    const lineas = [
      i18n.t("planes.usuarios", { cantidad: plan.users }),
      i18n.t("planes.conexiones", { cantidad: plan.connections }),
      i18n.t("planes.colas", { cantidad: plan.queues })
    ];

    const opcionales = [
      [plan.useWhatsapp, "planes.whatsapp"],
      [plan.useWhatsappOfficial, "planes.whatsappOficial"],
      [plan.useCampaigns, "planes.campanas"],
      [plan.useSchedules, "planes.agendamientos"],
      [plan.useKanban, "planes.kanban"],
      [plan.useOpenAi, "planes.ia"],
      [plan.useIntegrations, "planes.integraciones"],
      [plan.useExternalApi, "planes.api"]
    ];

    opcionales.forEach(([activa, clave]) => {
      if (activa) lineas.push(i18n.t(clave));
    });

    return lineas;
  };

  return (
    <Dialog open={!!abierto} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle>{i18n.t("planes.titulo")}</DialogTitle>

      <DialogContent>
        <Typography variant="body2" className={classes.intro}>
          {i18n.t("planes.subtitulo")}
        </Typography>

        {cargando && (
          <div className={classes.cargando}>
            <CircularProgress />
          </div>
        )}

        {!cargando && planes.length === 0 && (
          <Typography className={classes.vacio}>
            {i18n.t("planes.sinPlanes")}
          </Typography>
        )}

        {!cargando && planes.length > 0 && (
          <div className={classes.rejilla}>
            {planes.map(plan => {
              const esElActual = user?.company?.planId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`${classes.tarjeta} ${
                    esElActual ? classes.tarjetaActual : ""
                  }`}
                >
                  <Typography variant="overline" className={classes.nombre}>
                    {plan.name}
                  </Typography>

                  <Typography variant="h4" className={classes.precio}>
                    {`$${plan.amount}`}
                  </Typography>
                  <Typography variant="caption" className={classes.periodicidad}>
                    {i18n.t("planes.porMes")}
                  </Typography>

                  <ul className={classes.caracteristicas}>
                    {caracteristicasDe(plan).map(linea => (
                      <li key={linea} className={classes.caracteristica}>
                        <CheckCircleOutlineIcon className={classes.tic} />
                        {linea}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={esElActual ? "outlined" : "contained"}
                    color="primary"
                    disableElevation
                    fullWidth
                    className={classes.elegir}
                    disabled={contratando !== null}
                    onClick={() => contratar(plan)}
                  >
                    {contratando === plan.id
                      ? i18n.t("planes.contratando")
                      : i18n.t("planes.elegir", { plan: plan.name })}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SelectorPlanes;
