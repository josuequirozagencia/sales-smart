import React, { useState, useEffect } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

/**
 * Inscribir el contacto de un ticket en un flujo de GoHighLevel.
 *
 * Los flujos se leen del API de GHL. Si esa llamada falla, el backend cae
 * en los anotados a mano en la configuracion y lo indica en `origen`, para
 * poder avisar de que la lista puede estar incompleta en vez de mostrarla
 * como si fuera la buena.
 */
const GhlWorkflowModal = ({ open, onClose, ticket }) => {
  const [cargando, setCargando] = useState(false);
  const [flujos, setFlujos] = useState([]);
  const [origen, setOrigen] = useState("api");
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    if (!open) return;

    const cargar = async () => {
      setCargando(true);
      try {
        const { data } = await api.get("/ghl/workflows");
        setFlujos(data.workflows || []);
        setOrigen(data.origen);
      } catch (err) {
        toastError(err);
        setFlujos([]);
      }
      setCargando(false);
    };

    cargar();
  }, [open]);

  const inscribir = async (workflowId) => {
    setEnviando(workflowId);
    try {
      await api.post("/ghl/enroll", { ticketId: ticket?.id, workflowId });
      toast.success(i18n.t("ghlWorkflow.enrolled"));
      onClose();
    } catch (err) {
      toastError(err);
    }
    setEnviando(null);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{i18n.t("ghlWorkflow.title")}</DialogTitle>
      <DialogContent dividers>
        {cargando && (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <CircularProgress size={28} />
          </div>
        )}

        {!cargando && origen === "manual" && (
          <Typography variant="caption" color="textSecondary">
            {i18n.t("ghlWorkflow.manualSource")}
          </Typography>
        )}

        {!cargando && flujos.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("ghlWorkflow.empty")}
          </Typography>
        )}

        <List dense>
          {flujos.map((f) => (
            <ListItem
              key={f.id}
              button
              disabled={Boolean(enviando)}
              onClick={() => inscribir(f.id)}
            >
              <ListItemText primary={f.name || f.id} />
              {enviando === f.id && <CircularProgress size={18} />}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("ghlWorkflow.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GhlWorkflowModal;
