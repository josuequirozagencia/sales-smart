import React, { useEffect, useMemo, useState } from "react";
import {
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
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
import { Refresh, Search } from "@material-ui/icons";
import Alert from "@material-ui/lab/Alert";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import useWhatsApps from "../../hooks/useWhatsApps";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Plantillas de WhatsApp aprobadas por Meta, en solo lectura. Es el catalogo
// real de cada conexion (WhatsApp Oficial o GoHighLevel): se crean y se
// editan en Meta o en GHL, no aqui.

const CANALES_CON_PLANTILLAS = ["whatsapp_oficial", "ghl"];

const useStyles = makeStyles((theme) => ({
  mainPaper: { flex: 1, padding: theme.spacing(1), overflowY: "auto", ...theme.scrollbarStyles },
  filtros: { display: "flex", flexWrap: "wrap", gap: theme.spacing(1.5), alignItems: "center", marginBottom: theme.spacing(1) },
  selector: { minWidth: 260 },
  mensaje: { whiteSpace: "pre-wrap", maxWidth: 480, fontSize: "0.8125rem" },
  ayuda: { color: theme.palette.text.secondary },
}));

const colorEstado = (estado) =>
  ({ APPROVED: "primary", REJECTED: "secondary" }[String(estado || "").toUpperCase()] || "default");

/** Texto que ve el cliente: encabezado, cuerpo y pie, en ese orden. */
const textoDe = (plantilla) =>
  (plantilla.components || [])
    .filter((c) => ["HEADER", "BODY", "FOOTER"].includes(String(c.type).toUpperCase()) && c.text)
    .map((c) => c.text)
    .join("\n\n");

const fechaDe = (plantilla) => {
  // Meta no documenta la fecha de edicion en esta API; si algun dia viene,
  // se muestra, y si no, un guion.
  const valor = plantilla.last_updated_time || plantilla.updated_at || plantilla.last_updated_at;
  if (!valor) return "—";
  const fecha = typeof valor === "number" ? new Date(valor * 1000) : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleString();
};

const WhatsAppTemplates = () => {
  const classes = useStyles();
  const { whatsApps, loading: cargandoConexiones } = useWhatsApps();
  const conexiones = useMemo(
    () => whatsApps.filter((w) => CANALES_CON_PLANTILLAS.includes(w.channel)),
    [whatsApps]
  );

  const [conexionId, setConexionId] = useState("");
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!conexionId && conexiones.length) setConexionId(conexiones[0].id);
  }, [conexiones, conexionId]);

  const cargar = async (id = conexionId) => {
    if (!id) return;
    setCargando(true);
    setError(null);
    try {
      const { data } = await api.get(`/whatsapp/${id}/templates`);
      setPlantillas(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      const codigo = err?.response?.data?.error;
      setPlantillas([]);
      setError(
        codigo && i18n.exists(`backendErrors.${codigo}`)
          ? i18n.t(`backendErrors.${codigo}`)
          : codigo || i18n.t("whatsappTemplates.errors.generic")
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar(conexionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conexionId]);

  const visibles = plantillas.filter((p) => {
    const q = busqueda.trim().toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || textoDe(p).toLowerCase().includes(q);
  });

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("whatsappTemplates.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Tooltip title={i18n.t("whatsappTemplates.refresh")}>
            <span>
              <IconButton onClick={() => cargar()} disabled={!conexionId || cargando}>
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="caption" className={classes.ayuda} component="p" gutterBottom>
          {i18n.t("whatsappTemplates.help")}
        </Typography>

        <div className={classes.filtros}>
          <FormControl variant="outlined" size="small" className={classes.selector}>
            <InputLabel>{i18n.t("whatsappTemplates.connection")}</InputLabel>
            <Select
              value={conexionId}
              onChange={(e) => setConexionId(e.target.value)}
              label={i18n.t("whatsappTemplates.connection")}
            >
              {conexiones.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} · {c.channel === "ghl" ? "GoHighLevel" : "WhatsApp Oficial"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            variant="outlined"
            placeholder={i18n.t("whatsappTemplates.search")}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </div>

        {!cargandoConexiones && conexiones.length === 0 && (
          <Alert severity="info">{i18n.t("whatsappTemplates.noConnections")}</Alert>
        )}
        {error && <Alert severity="warning">{error}</Alert>}

        {conexiones.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("whatsappTemplates.table.name")}</TableCell>
                <TableCell>{i18n.t("whatsappTemplates.table.language")}</TableCell>
                <TableCell>{i18n.t("whatsappTemplates.table.category")}</TableCell>
                <TableCell>{i18n.t("whatsappTemplates.table.message")}</TableCell>
                <TableCell>{i18n.t("whatsappTemplates.table.status")}</TableCell>
                <TableCell>{i18n.t("whatsappTemplates.table.updated")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!cargando &&
                visibles.map((p) => (
                  <TableRow key={p.id || `${p.name}-${p.language}`}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.language}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>
                      <div className={classes.mensaje}>{textoDe(p) || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={p.status} color={colorEstado(p.status)} variant="outlined" />
                    </TableCell>
                    <TableCell>{fechaDe(p)}</TableCell>
                  </TableRow>
                ))}
              {cargando && <TableRowSkeleton columns={6} />}
              {!cargando && !error && visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" className={classes.ayuda}>
                      {i18n.t("whatsappTemplates.empty")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default WhatsAppTemplates;
