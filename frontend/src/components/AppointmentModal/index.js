import React, { useEffect, useState } from "react";

import {
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

/**
 * Agendar una cita o seguimiento con el contacto.
 *
 * Empieza por la fecha, que es lo que se viene a decidir. El recordatorio
 * es opcional y se envia al contacto por WhatsApp usando los mensajes
 * programados que el CRM ya tiene.
 */

// Antelaciones ofrecidas, en minutos.
const ANTELACIONES = [15, 30, 60, 120, 24 * 60];

// Mismo tope que aplica el servidor. Tres cubre el dia antes, unas horas
// antes y un ultimo aviso, sin convertir el recordatorio en acoso.
const MAX_AVISOS = 3;

const useStyles = makeStyles(theme => ({
  fila: {
    display: "flex",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  campo: { flex: "1 1 200px", minWidth: 160 },
  cabeceraAvisos: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
  },
  bloqueAviso: {
    borderLeft: `2px solid ${theme.palette.tokens.border.border}`,
    paddingLeft: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  aviso: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
    color: theme.palette.tokens.semantic.warning.text,
    fontSize: "0.75rem",
  },
}));

/** Fecha y hora de ahora en el formato que pide datetime-local. */
const enUnaHora = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  // El input espera hora LOCAL, no UTC: toISOString desplazaria la hora
  // segun el huso y propondria un momento equivocado.
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

const AppointmentModal = ({ open, onClose, contact, ticket, onSaved }) => {
  const classes = useStyles();

  const [scheduledAt, setScheduledAt] = useState(enUnaHora);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  // Hasta tres avisos. Se guardan como lista y no como tres variables
  // sueltas para que anadir o quitar uno no descoloque a los demas.
  const [avisos, setAvisos] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setScheduledAt(enUnaHora());
      setTitle("");
      setNotes("");
      setAvisos([]);
    }
  }, [open]);

  // Un aviso cuyo momento de envio ya paso no se programaria en el
  // servidor. Se marca aqui para que no parezca que se perdio.
  const esTardio = a =>
    scheduledAt &&
    new Date(scheduledAt).getTime() - a.minutesBefore * 60000 <= Date.now();

  const anadirAviso = () => {
    if (avisos.length >= MAX_AVISOS) return;
    // Cada aviso nuevo propone una antelacion distinta de las ya puestas:
    // tres avisos a la misma hora no serian tres avisos.
    const usadas = avisos.map(a => a.minutesBefore);
    const libre = ANTELACIONES.find(m => !usadas.includes(m)) ?? 60;
    setAvisos([...avisos, { body: "", minutesBefore: libre }]);
  };

  const cambiarAviso = (i, campo, valor) => {
    setAvisos(avisos.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  };

  const quitarAviso = i => setAvisos(avisos.filter((_, j) => j !== i));

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.post("/appointments", {
        contactId: contact.id,
        ticketId: ticket?.id,
        // Se manda en ISO para que el servidor reciba un instante absoluto
        // y no dependa de como interprete la cadena local.
        scheduledAt: new Date(scheduledAt).toISOString(),
        title,
        notes,
        reminders: avisos,
        whatsappId: ticket?.whatsappId,
      });
      toast.success(i18n.t("appointmentModal.toasts.created"));
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{i18n.t("appointmentModal.title")}</DialogTitle>
      <DialogContent dividers>
        {/* La fecha va primero: es lo que se viene a decidir. */}
        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            label={i18n.t("appointmentModal.form.when")}
            type="datetime-local"
            variant="outlined"
            size="small"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            className={classes.campo}
            label={i18n.t("appointmentModal.form.title")}
            variant="outlined"
            size="small"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <TextField
          fullWidth
          label={i18n.t("appointmentModal.form.notes")}
          variant="outlined"
          size="small"
          multiline
          minRows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className={classes.cabeceraAvisos}>
          <span>{i18n.t("appointmentModal.form.reminders")}</span>
          <Button
            size="small"
            color="primary"
            startIcon={<AddIcon />}
            onClick={anadirAviso}
            disabled={avisos.length >= MAX_AVISOS}
          >
            {i18n.t("appointmentModal.buttons.addReminder")}
          </Button>
        </div>

        {avisos.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("appointmentModal.noReminders")}
          </Typography>
        )}

        {avisos.map((a, i) => (
          <div key={i} className={classes.bloqueAviso}>
            <div className={classes.fila}>
              <TextField
                className={classes.campo}
                label={i18n.t("appointmentModal.form.reminderBody")}
                variant="outlined"
                size="small"
                multiline
                minRows={2}
                value={a.body}
                onChange={e => cambiarAviso(i, "body", e.target.value)}
              />
              <FormControl variant="outlined" size="small" className={classes.campo}>
                <InputLabel>{i18n.t("appointmentModal.form.leadTime")}</InputLabel>
                <Select
                  value={a.minutesBefore}
                  onChange={e => cambiarAviso(i, "minutesBefore", e.target.value)}
                  label={i18n.t("appointmentModal.form.leadTime")}
                >
                  {ANTELACIONES.map(m => (
                    <MenuItem key={m} value={m}>
                      {m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : `${m / 1440} d`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => quitarAviso(i)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </div>
            {esTardio(a) && (
              <div className={classes.aviso}>
                {i18n.t("appointmentModal.reminderTooLate")}
              </div>
            )}
          </div>
        ))}

        <Typography
          variant="caption"
          component="p"
          style={{ marginTop: 12, opacity: 0.75 }}
        >
          {i18n.t("appointmentModal.tagHint")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={guardando}>
          {i18n.t("appointmentModal.buttons.cancel")}
        </Button>
        <Button
          onClick={guardar}
          color="primary"
          variant="contained"
          disabled={guardando || !scheduledAt}
        >
          {i18n.t("appointmentModal.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppointmentModal;
