import React, { useEffect, useState } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

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

const useStyles = makeStyles(theme => ({
  fila: {
    display: "flex",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  campo: { flex: "1 1 200px", minWidth: 160 },
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
  const [conRecordatorio, setConRecordatorio] = useState(false);
  const [reminderBody, setReminderBody] = useState("");
  const [antelacion, setAntelacion] = useState(60);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setScheduledAt(enUnaHora());
      setTitle("");
      setNotes("");
      setConRecordatorio(false);
      setReminderBody("");
      setAntelacion(60);
    }
  }, [open]);

  // Un recordatorio cuyo momento de envio ya paso no se programaria en el
  // servidor. Se avisa aqui para que no parezca que se perdio.
  const avisoTardio =
    conRecordatorio &&
    scheduledAt &&
    new Date(scheduledAt).getTime() - antelacion * 60000 <= Date.now();

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
        reminderBody: conRecordatorio ? reminderBody : null,
        reminderMinutesBefore: antelacion,
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

        <FormControlLabel
          style={{ marginTop: 12 }}
          control={
            <Checkbox
              color="primary"
              checked={conRecordatorio}
              onChange={e => setConRecordatorio(e.target.checked)}
            />
          }
          label={i18n.t("appointmentModal.form.withReminder")}
        />

        {conRecordatorio && (
          <>
            <div className={classes.fila}>
              <TextField
                className={classes.campo}
                label={i18n.t("appointmentModal.form.reminderBody")}
                variant="outlined"
                size="small"
                multiline
                minRows={2}
                value={reminderBody}
                onChange={e => setReminderBody(e.target.value)}
              />
              <FormControl
                variant="outlined"
                size="small"
                className={classes.campo}
              >
                <InputLabel>
                  {i18n.t("appointmentModal.form.leadTime")}
                </InputLabel>
                <Select
                  value={antelacion}
                  onChange={e => setAntelacion(e.target.value)}
                  label={i18n.t("appointmentModal.form.leadTime")}
                >
                  {ANTELACIONES.map(m => (
                    <MenuItem key={m} value={m}>
                      {m < 60
                        ? `${m} min`
                        : m < 1440
                        ? `${m / 60} h`
                        : `${m / 1440} d`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            {avisoTardio && (
              <div className={classes.aviso}>
                {i18n.t("appointmentModal.reminderTooLate")}
              </div>
            )}
          </>
        )}

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
