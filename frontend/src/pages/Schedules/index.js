import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useContext,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import InputAdornment from "@material-ui/core/InputAdornment";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Typography from "@material-ui/core/Typography";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
// import MessageModal from "../../components/MessageModal"
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import moment from "moment";
import useAppointments from "./useAppointments";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { Calendar, momentLocalizer } from "react-big-calendar";
// Os nomes dos dias e meses do calendário vêm do locale do moment, não do
// objeto `messages` que já era traduzido. Como só o pt-br era importado — e
// importar um locale do moment já o deixa ativo —, a grade aparecia com
// "segunda-feira" mesmo com a interface em espanhol. Importar os três e
// escolher pelo idioma do i18n resolve; o inglês vem embutido no moment.
import "moment/locale/pt-br";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import "./Schedules.css"; // Importe o arquivo CSS

// Defina a função getUrlParam antes de usá-la
function getUrlParam(paramName) {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(paramName);
}

const eventTitleStyle = {
  fontSize: "14px", // Defina um tamanho de fonte menor
  overflow: "hidden", // Oculte qualquer conteúdo excedente
  whiteSpace: "nowrap", // Evite a quebra de linha do texto
  textOverflow: "ellipsis", // Exiba "..." se o texto for muito longo
};

// i18n.language pode vir como "es-EC" ou "pt-BR"; o moment usa "es" e "pt-br".
const momentLocaleFor = language => {
  const base = String(language || "").toLowerCase().split("-")[0];
  if (base === "pt") return "pt-br";
  if (base === "en") return "en";
  return "es";
};

moment.locale(momentLocaleFor(i18n.language));

const localizer = momentLocalizer(moment);
var defaultMessages = {
  date: i18n.t("schedules.date"),
  time: i18n.t("schedules.time"),
  event: i18n.t("schedules.event"),
  allDay: i18n.t("schedules.allDay"),
  week: i18n.t("schedules.week"),
  work_week: i18n.t("schedules.work_week"),
  day: i18n.t("schedules.day"),
  month: i18n.t("schedules.month"),
  previous: i18n.t("schedules.previous"),
  next: i18n.t("schedules.next"),
  yesterday: i18n.t("schedules.yesterday"),
  tomorrow: i18n.t("schedules.tomorrow"),
  today: i18n.t("schedules.today"),
  agenda: i18n.t("schedules.agenda"),
  noEventsInRange: i18n.t("schedules.noEventsInRange"),
  showMore: function showMore(total) {
    return "+" + total + " mais";
  },
};

const reducer = (state, action) => {
  if (action.type === "LOAD_SCHEDULES") {
    const schedules = action.payload;
    const newSchedules = [];

    schedules.forEach((schedule) => {
      const scheduleIndex = state.findIndex((s) => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        state[scheduleIndex] = schedule;
      } else {
        newSchedules.push(schedule);
      }
    });

    return [...state, ...newSchedules];
  }

  if (action.type === "UPDATE_SCHEDULES") {
    const schedule = action.payload;
    const scheduleIndex = state.findIndex((s) => s.id === schedule.id);

    if (scheduleIndex !== -1) {
      state[scheduleIndex] = schedule;
      return [...state];
    } else {
      return [schedule, ...state];
    }
  }

  if (action.type === "DELETE_SCHEDULE") {
    const scheduleId = action.payload;

    const scheduleIndex = state.findIndex((s) => s.id === scheduleId);
    if (scheduleIndex !== -1) {
      state.splice(scheduleIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  // Citas y mensajes conviven en la misma rejilla, asi que tienen que
  // distinguirse de un vistazo: un mensaje SE ENVIA SOLO, una cita es un
  // compromiso que alguien debe cumplir. Confundirlos seria peor que no
  // juntarlos.
  // Los eventos llevan texto blanco encima, asi que el fondo tiene que
  // darle 4,5 de contraste. Se usan las variantes "text" de los tokens,
  // mas oscuras, y no las "fill": medido, el azul de relleno daba 3,68 y
  // el verde 3,30, los dos por debajo del minimo.
  eventoCita: {
    backgroundColor: theme.palette.tokens.brand.primary,   // 5,85
    borderColor: theme.palette.tokens.brand.primary,
  },
  eventoCitaGoogle: {
    backgroundColor: theme.palette.tokens.semantic.info.text,   // 6,70
    borderColor: theme.palette.tokens.semantic.info.text,
  },
  eventoCitaHecha: {
    backgroundColor: theme.palette.tokens.semantic.success.text, // 5,02
    borderColor: theme.palette.tokens.semantic.success.text,
  },
  eventoCitaCancelada: {
    // Se conserva a la vista pero apagada: saber que algo se cancelo es
    // informacion, no ruido.
    opacity: 0.45,
    textDecoration: "line-through",
  },
  filtros: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    alignItems: "center",
  },
  selector: { minWidth: 150 },

  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    // "scroll" pintaba la barra siempre, incluso sin nada que desplazar.
    overflowY: "auto",
    borderRadius: theme.palette.tokens.radius.lg,
    ...theme.scrollbarStyles,
  },

  // ---------------------------------------------------------------------
  // Calendario
  //
  // react-big-calendar trae estilos pensados para fondo claro: rejilla
  // gris, cabeceras oscuras y hoy en amarillo palido. Sobre el modo oscuro
  // del CRM eso no se ve. Aqui se rehacen con los tokens del tema, que si
  // distinguen el modo.
  //
  // Lo que habia antes estaba roto de dos maneras: theme.palette.mode solo
  // existe en el tema v5 y esta pantalla usa el v4, asi que era undefined y
  // los botones se ponian NEGROS al pasar por encima incluso en oscuro; y
  // theme.palette.light es un objeto {main}, no un color, asi que como
  // valor CSS el navegador lo descartaba.
  // ---------------------------------------------------------------------
  calendarToolbar: {
    "& .rbc-toolbar": {
      marginBottom: theme.spacing(2),
      gap: theme.spacing(1),
      flexWrap: "wrap",
    },
    "& .rbc-toolbar-label": {
      color: theme.palette.text.primary,
      fontWeight: 600,
      fontSize: "1rem",
      textTransform: "capitalize",
    },
    "& .rbc-btn-group button": {
      color: theme.palette.text.secondary,
      borderColor: theme.palette.tokens.border.border,
      borderRadius: theme.palette.tokens.radius.md,
      padding: "4px 12px",
      transition: "background-color 180ms ease, color 180ms ease",
      "&:hover, &:focus": {
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
      },
      // La vista activa se marca con el color de marca y su texto legible
      // encima, no con un negro que desaparece sobre fondo oscuro.
      "&.rbc-active, &.rbc-active:hover, &.rbc-active:focus": {
        backgroundColor: theme.palette.tokens.brand.primary,
        color: theme.palette.tokens.brand.onPrimary,
        borderColor: theme.palette.tokens.brand.primary,
      },
    },

    // Rejilla y cabeceras.
    "& .rbc-month-view, & .rbc-time-view, & .rbc-agenda-view table": {
      border: `1px solid ${theme.palette.tokens.border.border}`,
      borderRadius: theme.palette.tokens.radius.md,
      overflow: "hidden",
    },
    "& .rbc-header": {
      padding: theme.spacing(1, 0.5),
      borderBottom: `1px solid ${theme.palette.tokens.border.border}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    },
    "& .rbc-month-row + .rbc-month-row, & .rbc-day-bg + .rbc-day-bg, & .rbc-header + .rbc-header":
      {
        borderColor: theme.palette.tokens.border.border,
      },
    "& .rbc-date-cell": {
      padding: theme.spacing(0.5),
      fontSize: "0.8125rem",
      color: theme.palette.text.primary,
    },

    // Dias de otro mes: se atenuan en vez de pintarse de gris fijo, que
    // sobre fondo oscuro quedaba mas claro que el resto.
    "& .rbc-off-range-bg": {
      backgroundColor: "transparent",
    },
    "& .rbc-off-range .rbc-button-link": {
      opacity: 0.35,
    },

    // Hoy: un tinte de marca en vez del amarillo de serie.
    "& .rbc-today": {
      backgroundColor: `${theme.palette.tokens.brand.primary}14`,
    },

    // Eventos.
    "& .rbc-event": {
      borderRadius: theme.palette.tokens.radius.sm,
      padding: "2px 6px",
      fontSize: "0.75rem",
      border: "none",
      // El foco por teclado tiene que verse: sin esto no hay forma de
      // saber en que evento estas al tabular.
      "&:focus": {
        outline: `2px solid ${theme.palette.tokens.brand.onSurface}`,
        outlineOffset: 1,
      },
    },
    "& .rbc-show-more": {
      color: theme.palette.tokens.brand.onSurface,
      backgroundColor: "transparent",
      fontWeight: 600,
    },
  },
}));

const Schedules = () => {
  const classes = useStyles();
  const history = useHistory();

  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [schedules, dispatch] = useReducer(reducer, []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(+getUrlParam("contactId"));

  // Que se muestra en el calendario: todo, solo citas o solo mensajes.
  const [queVer, setQueVer] = useState("todo");
  // Filtro por asesor, util solo para quien ve las citas de varios.
  const [asesorId, setAsesorId] = useState("");
  // Cita sobre la que se pulso, para ofrecer sus acciones.
  const [citaAbierta, setCitaAbierta] = useState(null);

  const {
    appointments,
    // recargar no se extrae: cambiarEstado ya refresca, y aqui las citas
    // no cambian por ninguna otra via.
    cambiarEstado,
    idsDeRecordatorios,
    asesores
  } = useAppointments();

  const esAdmin = user?.profile === "admin";

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useSchedules) {
        toast.error(
          i18n.t("schedules.errors.noPermission")
        );
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
  }, [user, history, getPlanCompany]);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/schedules", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  }, [searchParam, pageNumber]);

  const handleOpenScheduleModalFromContactId = useCallback(() => {
    if (contactId) {
      handleOpenScheduleModal();
    }
  }, [contactId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchSchedules();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    contactId,
    fetchSchedules,
    handleOpenScheduleModalFromContactId,
  ]);

  useEffect(() => {
    // handleOpenScheduleModalFromContactId();
    // const socket = socketManager.GetSocket(user.companyId, user.id);

    const onCompanySchedule = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: +data.scheduleId });
      }
    };

    socket.on(`company${user.companyId}-schedule`, onCompanySchedule);

    return () => {
      socket.off(`company${user.companyId}-schedule`, onCompanySchedule);
    };
  }, [socket]);

  const cleanContact = () => {
    setContactId("");
  };

  const handleOpenScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/schedules/${scheduleId}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingSchedule(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchSchedules();
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const truncate = (str, len) => {
    if (str.length > len) {
      return str.substring(0, len) + "...";
    }
    return str;
  };

  // Al pulsar un evento: si es una cita se ofrecen sus acciones; si es un
  // mensaje programado no se hace nada, porque ya lleva sus iconos encima.
  const alPulsarEvento = evento => {
    if (evento.tipo === "cita") setCitaAbierta(evento.cita);
  };

  const accionCita = async estado => {
    if (!citaAbierta) return;
    try {
      await cambiarEstado(citaAbierta.id, estado);
      toast.success(i18n.t("schedules.appointment.updated"));
    } catch (err) {
      toastError(err);
    } finally {
      setCitaAbierta(null);
    }
  };

  const irAConversacion = () => {
    if (citaAbierta?.ticket?.uuid) {
      history.push(`/tickets/${citaAbierta.ticket.uuid}`);
    }
    setCitaAbierta(null);
  };

  // --- Eventos del calendario -------------------------------------------
  //
  // Se mezclan dos cosas distintas y hay que mantenerlas distinguibles: un
  // mensaje programado se envia solo; una cita es un compromiso que
  // alguien debe cumplir.

  // Los recordatorios de una cita son mensajes programados, asi que sin
  // filtrarlos apareceria el mismo aviso DOS VECES: como cita y como
  // mensaje. Se conserva la cita, que es lo que interesa en una agenda.
  const mensajesVisibles = schedules.filter(
    m => !idsDeRecordatorios.has(m.id)
  );

  const citasVisibles = appointments.filter(
    a => !asesorId || (a.user && a.user.id === Number(asesorId))
  );

  const eventosMensajes = mensajesVisibles.map(schedule => ({
    tipo: "mensaje",
    title: (
      <div key={"m" + schedule.id} className="event-container">
        <div style={eventTitleStyle}>{schedule?.contact?.name}</div>
        <DeleteOutlineIcon
          onClick={() => handleDeleteSchedule(schedule.id)}
          className="delete-icon"
        />
        <EditIcon
          onClick={() => {
            handleEditSchedule(schedule);
            setScheduleModalOpen(true);
          }}
          className="edit-icon"
        />
      </div>
    ),
    start: new Date(schedule.sendAt),
    end: new Date(schedule.sendAt)
  }));

  const eventosCitas = citasVisibles.map(cita => ({
    tipo: "cita",
    cita,
    title: (
      <div key={"c" + cita.id} className="event-container">
        {/* El tipo NO puede distinguirse solo por color: quien no
            diferencie el azul del verde se quedaria sin la informacion.
            Cada estado lleva ademas su marca. */}
        <span className="event-mark" aria-hidden="true">
          {cita.status === "done"
            ? "✓"
            : cita.status === "cancelled"
            ? "✕"
            : cita.origin === "google"
            ? "G"
            : "●"}
        </span>
        <div style={eventTitleStyle}>
          {cita.contact ? cita.contact.name : cita.title || "—"}
        </div>
      </div>
    ),
    start: new Date(cita.scheduledAt),
    end: new Date(cita.scheduledAt)
  }));

  const eventos =
    queVer === "citas"
      ? eventosCitas
      : queVer === "mensajes"
      ? eventosMensajes
      : [...eventosMensajes, ...eventosCitas];

  // Color por tipo y estado. La cita cancelada no se oculta: saber que algo
  // se cancelo es informacion, no ruido.
  const estiloEvento = evento => {
    if (evento.tipo !== "cita") return {};
    const c = evento.cita;
    const clases = [];
    if (c.status === "done") clases.push(classes.eventoCitaHecha);
    else if (c.origin === "google") clases.push(classes.eventoCitaGoogle);
    else clases.push(classes.eventoCita);
    if (c.status === "cancelled") clases.push(classes.eventoCitaCancelada);
    return { className: clases.join(" ") };
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingSchedule &&
          `${i18n.t("schedules.confirmationModal.deleteTitle")}`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteSchedule(deletingSchedule.id)}
      >
        {i18n.t("schedules.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {scheduleModalOpen && (
        <ScheduleModal
          open={scheduleModalOpen}
          onClose={handleCloseScheduleModal}
          reload={fetchSchedules}
          // aria-labelledby="form-dialog-title"
          scheduleId={selectedSchedule ? selectedSchedule.id : null}
          contactId={contactId}
          cleanContact={cleanContact}
          user={user}
        />
      )}
      <MainHeader>
        <Title>
          {i18n.t("schedules.title")} ({eventos.length})
        </Title>
        <MainHeaderButtonsWrapper>
          <div className={classes.filtros}>
            <TextField
              select
              size="small"
              variant="outlined"
              className={classes.selector}
              value={queVer}
              onChange={e => setQueVer(e.target.value)}
              label={i18n.t("schedules.view.label")}
            >
              <MenuItem value="todo">{i18n.t("schedules.view.all")}</MenuItem>
              <MenuItem value="citas">{i18n.t("schedules.view.appointments")}</MenuItem>
              <MenuItem value="mensajes">{i18n.t("schedules.view.messages")}</MenuItem>
            </TextField>

            {/* Filtrar por asesor solo tiene sentido para quien ve las
                citas de varios; a un asesor le sobraria. */}
            {esAdmin && asesores.length > 1 && (
              <TextField
                select
                size="small"
                variant="outlined"
                className={classes.selector}
                value={asesorId}
                onChange={e => setAsesorId(e.target.value)}
                label={i18n.t("schedules.view.byUser")}
              >
                <MenuItem value="">{i18n.t("schedules.view.allUsers")}</MenuItem>
                {asesores.map(a => (
                  <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                ))}
              </TextField>
            )}
          </div>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenScheduleModal}
          >
            {i18n.t("schedules.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Calendar
          messages={defaultMessages}
          formats={{
            agendaDateFormat: "DD/MM ddd",
            weekdayFormat: "dddd",
          }}
          localizer={localizer}
          events={eventos}
          eventPropGetter={estiloEvento}
          onSelectEvent={alPulsarEvento}
          startAccessor="start"
          endAccessor="end"
          // Alto adaptable: 500px fijos dejaban hueco muerto en pantallas
          // grandes y obligaban a desplazar en portatiles.
          style={{ height: "calc(100vh - 260px)", minHeight: 420 }}
          className={classes.calendarToolbar}
        />
      </Paper>

      {/* Acciones de una cita. Un mensaje programado no pasa por aqui:
          sus iconos de editar y borrar van en el propio evento. */}
      <Dialog open={!!citaAbierta} onClose={() => setCitaAbierta(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {citaAbierta?.title || i18n.t("schedules.appointment.title")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            {citaAbierta?.contact
              ? citaAbierta.contact.name
              : i18n.t("schedules.appointment.noContact")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {citaAbierta && new Date(citaAbierta.scheduledAt).toLocaleString()}
          </Typography>
          {citaAbierta?.notes && (
            <Typography variant="body2" style={{ marginTop: 8 }}>
              {citaAbierta.notes}
            </Typography>
          )}
          {citaAbierta?.origin === "google" && (
            <Typography variant="caption" color="textSecondary" component="p" style={{ marginTop: 8 }}>
              {i18n.t("schedules.appointment.fromGoogle")}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {citaAbierta?.ticket?.uuid && (
            <Button onClick={irAConversacion}>
              {i18n.t("schedules.appointment.goToChat")}
            </Button>
          )}
          <Button onClick={() => accionCita("cancelled")}>
            {i18n.t("schedules.appointment.cancel")}
          </Button>
          <Button color="primary" variant="contained" onClick={() => accionCita("done")}>
            {i18n.t("schedules.appointment.done")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default Schedules;
