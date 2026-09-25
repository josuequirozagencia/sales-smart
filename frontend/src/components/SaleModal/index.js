import React, { useCallback, useEffect, useState } from "react";

import {
  Button,
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

import api from "../../services/api";
import toastError from "../../errors/toastError";
import useTicketPipelineStage from "../../hooks/useTicketPipelineStage";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

/**
 * Registro de una venta desde la ficha del contacto.
 *
 * Los productos que ofrece salen de la cola del ticket: cada cola tiene su
 * catalogo, asi que el asesor solo ve lo que le toca vender. Si el ticket
 * no tiene cola, el producto se escribe a mano.
 */

// Formas de pago. Lista fija y no tabla: cambia poco y no se gana nada
// obligando a mantener un catalogo mas.
const FORMAS_DE_PAGO = [
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Deposito",
  "Otro",
];

const useStyles = makeStyles(theme => ({
  fila: {
    display: "flex",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  campo: {
    flex: "1 1 180px",
    minWidth: 140,
  },
  // Lo pendiente no se escribe: sale de total menos abono. Mostrarlo como
  // campo editable invitaria a teclear una cifra que contradijera a las
  // otras dos.
  pendiente: {
    flex: "1 1 180px",
    minWidth: 140,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
  },
  etiquetaPendiente: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  valorPendiente: {
    fontWeight: 700,
    fontSize: "1.125rem",
  },
}));

const aNumero = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const SaleModal = ({ open, onClose, contact, ticket, onSaved }) => {
  const classes = useStyles();

  // Embudo y etapa del ticket. Se ven y se cambian aqui para no tener que
  // abrir la ficha del contacto aparte, pero son del TICKET, no de la venta:
  // elegir una etapa la aplica en el momento, se guarde la venta o no. El
  // payload de /sales no cambia.
  const {
    pipelines,
    pipelineId,
    setPipelineId,
    stages,
    stageId,
    selectStage,
  } = useTicketPipelineStage(ticket, open && Boolean(ticket?.id));

  const [productos, setProductos] = useState([]);
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(FORMAS_DE_PAGO[0]);
  const [notes, setNotes] = useState("");
  const [guardando, setGuardando] = useState(false);

  const queueId = ticket?.queueId;

  const cargarProductos = useCallback(async () => {
    if (!open || !queueId) {
      setProductos([]);
      return;
    }
    try {
      const { data } = await api.get(`/queues/${queueId}/products`, {
        params: { onlyActive: true },
      });
      setProductos(data);
    } catch (err) {
      toastError(err);
    }
  }, [open, queueId]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  // Al abrir se limpia todo: si no, el importe de la venta anterior
  // aparecería propuesto en la siguiente.
  useEffect(() => {
    if (open) {
      setProductId("");
      setProductName("");
      setTotal("");
      setDeposit("");
      setPaymentMethod(FORMAS_DE_PAGO[0]);
      setNotes("");
    }
  }, [open]);

  const elegirProducto = id => {
    setProductId(id);
    const p = productos.find(x => x.id === id);
    // El precio del catalogo es una propuesta, no una imposicion: se
    // negocian descuentos, y el campo queda editable.
    if (p && p.price !== null && p.price !== undefined) {
      setTotal(String(p.price));
    }
  };

  const pendiente = Math.max(0, aNumero(total) - aNumero(deposit));

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.post("/sales", {
        contactId: contact.id,
        ticketId: ticket?.id,
        queueId,
        productId: productId || null,
        productName: productId ? undefined : productName || null,
        total: total === "" ? 0 : total,
        deposit: deposit === "" ? 0 : deposit,
        paymentMethod,
        notes,
      });
      toast.success(i18n.t("saleModal.toasts.created"));
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
      <DialogTitle>{i18n.t("saleModal.title")}</DialogTitle>
      <DialogContent dividers>
        {/* Sin ticket no hay nada que mover, asi que la fila no aparece. */}
        {ticket?.id && (
          <div className={classes.fila}>
            {pipelines.length > 1 && (
              <FormControl variant="outlined" className={classes.campo} size="small">
                <InputLabel>{i18n.t("saleModal.form.pipeline")}</InputLabel>
                <Select
                  value={pipelineId}
                  onChange={e => setPipelineId(e.target.value)}
                  label={i18n.t("saleModal.form.pipeline")}
                >
                  {pipelines.map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl variant="outlined" className={classes.campo} size="small">
              <InputLabel>{i18n.t("saleModal.form.stage")}</InputLabel>
              <Select
                value={stageId}
                onChange={e => selectStage(e.target.value)}
                label={i18n.t("saleModal.form.stage")}
              >
                <MenuItem value="">
                  <em>{i18n.t("saleModal.form.noStage")}</em>
                </MenuItem>
                {stages.map(t => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        )}

        <div className={classes.fila}>
          {queueId && productos.length > 0 ? (
            <FormControl variant="outlined" className={classes.campo} size="small">
              <InputLabel>{i18n.t("saleModal.form.product")}</InputLabel>
              <Select
                value={productId}
                onChange={e => elegirProducto(e.target.value)}
                label={i18n.t("saleModal.form.product")}
              >
                <MenuItem value="">
                  <em>{i18n.t("saleModal.form.noProduct")}</em>
                </MenuItem>
                {productos.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.price !== null && p.price !== undefined
                      ? `  ·  ${Number(p.price).toFixed(2)}`
                      : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            // Sin cola o sin catalogo, el producto se escribe a mano en vez
            // de bloquear el registro de la venta.
            <TextField
              className={classes.campo}
              label={i18n.t("saleModal.form.productFree")}
              variant="outlined"
              size="small"
              value={productName}
              onChange={e => setProductName(e.target.value)}
            />
          )}

          <FormControl variant="outlined" className={classes.campo} size="small">
            <InputLabel>{i18n.t("saleModal.form.paymentMethod")}</InputLabel>
            <Select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              label={i18n.t("saleModal.form.paymentMethod")}
            >
              {FORMAS_DE_PAGO.map(m => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            label={i18n.t("saleModal.form.total")}
            variant="outlined"
            size="small"
            type="number"
            inputProps={{ min: 0, step: "0.01" }}
            value={total}
            onChange={e => setTotal(e.target.value)}
          />
          <TextField
            className={classes.campo}
            label={i18n.t("saleModal.form.deposit")}
            variant="outlined"
            size="small"
            type="number"
            inputProps={{ min: 0, step: "0.01" }}
            value={deposit}
            onChange={e => setDeposit(e.target.value)}
          />
          <div className={classes.pendiente}>
            <span className={classes.etiquetaPendiente}>
              {i18n.t("saleModal.form.pending")}
            </span>
            <span className={classes.valorPendiente}>
              {pendiente.toFixed(2)}
            </span>
          </div>
        </div>

        <TextField
          fullWidth
          label={i18n.t("saleModal.form.notes")}
          variant="outlined"
          size="small"
          multiline
          minRows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <Typography
          variant="caption"
          component="p"
          style={{ marginTop: 12, opacity: 0.75 }}
        >
          {i18n.t("saleModal.tagHint")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={guardando}>
          {i18n.t("saleModal.buttons.cancel")}
        </Button>
        <Button
          onClick={guardar}
          color="primary"
          variant="contained"
          disabled={guardando}
        >
          {i18n.t("saleModal.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleModal;
