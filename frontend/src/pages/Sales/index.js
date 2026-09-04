import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import {
  Avatar,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import InputAdornment from "@material-ui/core/InputAdornment";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ChatIcon from "@material-ui/icons/Chat";
import GetAppIcon from "@material-ui/icons/GetApp";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

/**
 * Pantalla de Ventas.
 *
 * La cabecera resume el periodo filtrado y la tabla lo detalla. Los
 * totales los calcula el servidor sobre TODAS las ventas del filtro, no
 * sobre la pagina visible: sumar solo lo que se ve mentiria en cuanto
 * hubiera mas de cuarenta.
 */

const FORMAS_DE_PAGO = ["Efectivo", "Tarjeta", "Transferencia", "Deposito", "Otro"];

const useStyles = makeStyles(theme => ({
  contenedor: {
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },

  tarjetas: {
    display: "grid",
    // Se reacomodan solas: en movil caen a una columna sin necesidad de
    // puntos de corte a mano.
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  tarjeta: {
    padding: theme.spacing(2),
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.tokens.border.border}`,
    backgroundColor: theme.palette.tokens.surface.surface,
  },
  tarjetaEtiqueta: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },
  tarjetaValor: {
    fontSize: "1.5rem",
    fontWeight: 700,
    marginTop: theme.spacing(0.5),
  },
  // Cada cifra con el color de lo que significa, igual que en la tabla.
  valorFacturado: { color: theme.palette.text.primary },
  valorAbonado: { color: theme.palette.tokens.semantic.success.text },
  valorPendiente: { color: theme.palette.tokens.semantic.warning.text },
  valorNeutro: { color: theme.palette.tokens.brand.onSurface },

  filtros: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  buscador: { flex: "1 1 240px", minWidth: 180 },
  filtro: { flex: "0 1 180px", minWidth: 150 },

  tabla: {
    border: `1px solid ${theme.palette.tokens.border.border}`,
    borderRadius: theme.palette.tokens.radius.lg,
    // Una tabla de nueve columnas no cabe en un movil: se desplaza dentro
    // de su caja en vez de desbordar la pagina.
    overflowX: "auto",
  },
  celdaContacto: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minWidth: 160,
  },
  avatar: { width: 32, height: 32, fontSize: "0.875rem" },
  importe: { fontWeight: 600, whiteSpace: "nowrap" },
  abonado: { color: theme.palette.tokens.semantic.success.text, fontWeight: 600, whiteSpace: "nowrap" },
  pendiente: { color: theme.palette.tokens.semantic.warning.text, fontWeight: 600, whiteSpace: "nowrap" },
  vacio: { padding: theme.spacing(5), textAlign: "center", color: theme.palette.text.secondary },
}));

const formatear = n =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const Sales = () => {
  const classes = useStyles();
  const history = useHistory();

  const [ventas, setVentas] = useState([]);
  const [totales, setTotales] = useState({
    billed: 0, paid: 0, pending: 0, count: 0, newCount: 0, crossSellCount: 0,
  });
  const [busqueda, setBusqueda] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [cargando, setCargando] = useState(false);
  const [paraBorrar, setParaBorrar] = useState(null);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/sales", {
        params: {
          searchParam: busqueda,
          paymentMethod: formaPago || undefined,
        },
      });
      setVentas(data.sales);
      setTotales(data.totals);
    } catch (err) {
      toastError(err);
    } finally {
      setCargando(false);
    }
  }, [busqueda, formaPago]);

  // Se espera medio segundo desde la ultima tecla: sin eso cada letra
  // lanzaria una consulta con sus totales.
  useEffect(() => {
    const t = setTimeout(cargar, 500);
    return () => clearTimeout(t);
  }, [cargar]);

  const borrar = async () => {
    if (!paraBorrar) return;
    try {
      await api.delete(`/sales/${paraBorrar.id}`);
      await cargar();
      toast.success(i18n.t("sales.toasts.deleted"));
    } catch (err) {
      toastError(err);
    } finally {
      setParaBorrar(null);
    }
  };

  const exportar = async () => {
    setExportando(true);
    try {
      // El CSV lo arma el servidor con TODAS las ventas del filtro: la
      // pantalla solo tiene cargada la pagina visible.
      const { data } = await api.get("/sales/export", {
        params: {
          searchParam: busqueda,
          paymentMethod: formaPago || undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Sin esto el blob se queda en memoria hasta recargar la pagina.
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    } finally {
      setExportando(false);
    }
  };

  const irAConversacion = venta => {
    if (venta.ticket?.uuid) history.push(`/tickets/${venta.ticket.uuid}`);
  };

  const tarjetas = [
    { etiqueta: i18n.t("sales.cards.billed"), valor: formatear(totales.billed), clase: classes.valorFacturado },
    { etiqueta: i18n.t("sales.cards.paid"), valor: formatear(totales.paid), clase: classes.valorAbonado },
    { etiqueta: i18n.t("sales.cards.pending"), valor: formatear(totales.pending), clase: classes.valorPendiente },
    { etiqueta: i18n.t("sales.cards.new"), valor: totales.newCount, clase: classes.valorNeutro },
    { etiqueta: i18n.t("sales.cards.crossSell"), valor: totales.crossSellCount, clase: classes.valorNeutro },
  ];

  return (
    <MainContainer>
      <MainHeader>
        <Title>
          {i18n.t("sales.title")} ({totales.count})
        </Title>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<GetAppIcon />}
          onClick={exportar}
          disabled={exportando || totales.count === 0}
        >
          {i18n.t("sales.buttons.export")}
        </Button>
      </MainHeader>

      <Paper className={classes.contenedor} variant="outlined">
        <div className={classes.tarjetas}>
          {tarjetas.map(t => (
            <div key={t.etiqueta} className={classes.tarjeta}>
              <div className={classes.tarjetaEtiqueta}>{t.etiqueta}</div>
              <div className={`${classes.tarjetaValor} ${t.clase}`}>{t.valor}</div>
            </div>
          ))}
        </div>

        <div className={classes.filtros}>
          <TextField
            className={classes.buscador}
            placeholder={i18n.t("sales.searchPlaceholder")}
            variant="outlined"
            size="small"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl variant="outlined" size="small" className={classes.filtro}>
            <InputLabel>{i18n.t("sales.filters.payment")}</InputLabel>
            <Select
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              label={i18n.t("sales.filters.payment")}
            >
              <MenuItem value="">{i18n.t("sales.filters.allPayments")}</MenuItem>
              {FORMAS_DE_PAGO.map(m => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <Paper variant="outlined" className={classes.tabla} elevation={0}>
          {ventas.length === 0 ? (
            <Typography variant="body2" className={classes.vacio}>
              {cargando ? i18n.t("sales.loading") : i18n.t("sales.empty")}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("sales.table.contact")}</TableCell>
                  <TableCell>{i18n.t("sales.table.product")}</TableCell>
                  <TableCell>{i18n.t("sales.table.type")}</TableCell>
                  <TableCell>{i18n.t("sales.table.payment")}</TableCell>
                  <TableCell align="right">{i18n.t("sales.table.total")}</TableCell>
                  <TableCell align="right">{i18n.t("sales.table.paid")}</TableCell>
                  <TableCell align="right">{i18n.t("sales.table.pending")}</TableCell>
                  <TableCell>{i18n.t("sales.table.date")}</TableCell>
                  <TableCell align="center">{i18n.t("sales.table.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ventas.map(v => {
                  const pendiente = Math.max(0, Number(v.total || 0) - Number(v.deposit || 0));
                  return (
                    <TableRow key={v.id} hover>
                      <TableCell>
                        <div className={classes.celdaContacto}>
                          <Avatar
                            className={classes.avatar}
                            src={v.contact?.urlPicture || undefined}
                          >
                            {v.contact?.name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <div>
                            <div>{v.contact?.name}</div>
                            <Typography variant="caption" color="textSecondary">
                              {v.contact?.number}
                            </Typography>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{v.productName || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            v.isFirstPurchase
                              ? i18n.t("sales.type.new")
                              : i18n.t("sales.type.crossSell")
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{v.paymentMethod || "—"}</TableCell>
                      <TableCell align="right" className={classes.importe}>
                        {formatear(v.total)}
                      </TableCell>
                      <TableCell align="right" className={classes.abonado}>
                        {formatear(v.deposit)}
                      </TableCell>
                      <TableCell align="right" className={classes.pendiente}>
                        {formatear(pendiente)}
                      </TableCell>
                      <TableCell style={{ whiteSpace: "nowrap" }}>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center" style={{ whiteSpace: "nowrap" }}>
                        {v.ticket?.uuid && (
                          <Tooltip title={i18n.t("sales.buttons.goToChat")}>
                            <IconButton size="small" onClick={() => irAConversacion(v)}>
                              <ChatIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={i18n.t("sales.buttons.delete")}>
                          <IconButton size="small" onClick={() => setParaBorrar(v)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Paper>

      <ConfirmationModal
        title={i18n.t("sales.confirmDelete.title")}
        open={!!paraBorrar}
        onClose={() => setParaBorrar(null)}
        onConfirm={borrar}
      >
        {i18n.t("sales.confirmDelete.message")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default Sales;
