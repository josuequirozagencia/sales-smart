import React, { useState, useEffect, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@material-ui/core";
import { CreateIcon, BlockIcon } from "../../components/Icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  bloque: {
    padding: theme.palette.tokens.space.lg,
    marginBottom: theme.palette.tokens.space.lg,
    borderRadius: theme.palette.tokens.radius.lg,
  },
  titulo: {
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: theme.palette.tokens.text.primary,
    marginBottom: theme.palette.tokens.space.xs,
  },
  ayuda: {
    fontSize: "0.8125rem",
    color: theme.palette.tokens.text.secondary,
    lineHeight: 1.5,
    marginBottom: theme.palette.tokens.space.md,
  },
  fila: {
    display: "flex",
    gap: theme.palette.tokens.space.md,
    flexWrap: "wrap",
    marginBottom: theme.palette.tokens.space.md,
  },
  campo: {
    flex: "1 1 260px",
  },
  // La URL es larga y hay que copiarla entera: monoespaciada y con salto
  // de linea, en vez de recortada con puntos suspensivos.
  url: {
    fontFamily: "monospace",
    fontSize: "0.75rem",
    wordBreak: "break-all",
    padding: theme.palette.tokens.space.sm,
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
    color: theme.palette.tokens.text.primary,
  },
  acciones: {
    display: "flex",
    gap: theme.palette.tokens.space.sm,
  },
}));

const PLANTILLA_VACIA = { name: "", language: "es", body: "" };

const GoHighLevel = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [cargando, setCargando] = useState(true);
  const [config, setConfig] = useState({
    tieneToken: false,
    locationId: "",
    isActive: true,
    urlWebhook: "",
  });
  // El token guardado NUNCA vuelve del servidor. Este campo empieza vacio
  // siempre y solo se manda si se escribe algo.
  const [token, setToken] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [plantillas, setPlantillas] = useState([]);
  const [dialogo, setDialogo] = useState(false);
  const [editando, setEditando] = useState(PLANTILLA_VACIA);

  const esAdmin = user.profile === "admin";

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/ghl/config");
      setConfig(data);
    } catch (err) {
      toastError(err);
    }
    try {
      const { data } = await api.get("/ghl/templates");
      setPlantillas(data);
    } catch (err) {
      // Las plantillas son secundarias: si fallan, la pantalla sigue
      // sirviendo para configurar la conexion.
      setPlantillas([]);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarConfig = async () => {
    if (!config.locationId) {
      toast.error(i18n.t("goHighLevel.errors.locationRequired"));
      return;
    }
    setGuardando(true);
    try {
      const { data } = await api.put("/ghl/config", {
        token: token || undefined,
        locationId: config.locationId,
        isActive: config.isActive,
      });
      setConfig(data);
      setToken("");
      toast.success(i18n.t("goHighLevel.saved"));
    } catch (err) {
      toastError(err);
    }
    setGuardando(false);
  };

  const guardarPlantilla = async () => {
    if (!editando.name || !editando.body) {
      toast.error(i18n.t("goHighLevel.errors.templateRequired"));
      return;
    }
    try {
      if (editando.id) {
        await api.put(`/ghl/templates/${editando.id}`, editando);
      } else {
        await api.post("/ghl/templates", editando);
      }
      setDialogo(false);
      setEditando(PLANTILLA_VACIA);
      cargar();
    } catch (err) {
      toastError(err);
    }
  };

  const borrarPlantilla = async (id) => {
    try {
      await api.delete(`/ghl/templates/${id}`);
      cargar();
    } catch (err) {
      toastError(err);
    }
  };

  const copiar = () => {
    navigator.clipboard?.writeText(config.urlWebhook);
    toast.success(i18n.t("goHighLevel.copied"));
  };

  if (cargando) {
    return (
      <MainContainer>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <CircularProgress />
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("goHighLevel.title")}</Title>
      </MainHeader>

      {/* --- Credenciales --- */}
      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.titulo}>
          {i18n.t("goHighLevel.connection.title")}
        </div>
        <div className={classes.ayuda}>
          {i18n.t("goHighLevel.connection.help")}
        </div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            type="password"
            autoComplete="new-password"
            label={i18n.t("goHighLevel.connection.token")}
            placeholder={
              config.tieneToken
                ? i18n.t("goHighLevel.connection.tokenSaved")
                : ""
            }
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={!esAdmin}
          />
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            label={i18n.t("goHighLevel.connection.locationId")}
            value={config.locationId || ""}
            onChange={(e) =>
              setConfig({ ...config, locationId: e.target.value })
            }
            disabled={!esAdmin}
          />
        </div>

        <FormControlLabel
          control={
            <Switch
              size="small"
              color="primary"
              checked={Boolean(config.isActive)}
              onChange={(e) =>
                setConfig({ ...config, isActive: e.target.checked })
              }
              disabled={!esAdmin}
            />
          }
          label={i18n.t("goHighLevel.connection.active")}
        />

        {esAdmin && (
          <div style={{ marginTop: 12 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={guardarConfig}
              disabled={guardando}
            >
              {i18n.t("goHighLevel.save")}
            </Button>
          </div>
        )}
      </Paper>

      {/* --- Webhook --- */}
      {config.urlWebhook && (
        <Paper className={classes.bloque} variant="outlined">
          <div className={classes.titulo}>
            {i18n.t("goHighLevel.webhook.title")}
          </div>
          <div className={classes.ayuda}>
            {i18n.t("goHighLevel.webhook.help")}
          </div>
          <div className={classes.url}>{config.urlWebhook}</div>
          <div style={{ marginTop: 12 }}>
            <Button size="small" variant="outlined" onClick={copiar}>
              {i18n.t("goHighLevel.webhook.copy")}
            </Button>
          </div>
        </Paper>
      )}

      {/* --- Plantillas --- */}
      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.titulo}>
          {i18n.t("goHighLevel.templates.title")}
        </div>
        <div className={classes.ayuda}>
          {i18n.t("goHighLevel.templates.help")}
        </div>

        {esAdmin && (
          <div style={{ marginBottom: 12 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setEditando(PLANTILLA_VACIA);
                setDialogo(true);
              }}
            >
              {i18n.t("goHighLevel.templates.add")}
            </Button>
          </div>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("goHighLevel.templates.name")}</TableCell>
              <TableCell>{i18n.t("goHighLevel.templates.language")}</TableCell>
              <TableCell>{i18n.t("goHighLevel.templates.body")}</TableCell>
              {esAdmin && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {plantillas.length === 0 && (
              <TableRow>
                <TableCell colSpan={esAdmin ? 4 : 3}>
                  {i18n.t("goHighLevel.templates.empty")}
                </TableCell>
              </TableRow>
            )}
            {plantillas.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.language}</TableCell>
                <TableCell>{p.body}</TableCell>
                {esAdmin && (
                  <TableCell align="right">
                    <div className={classes.acciones}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditando(p);
                          setDialogo(true);
                        }}
                      >
                        <CreateIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => borrarPlantilla(p.id)}
                      >
                        <BlockIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogo} onClose={() => setDialogo(false)} fullWidth maxWidth="sm">
        <DialogTitle>{i18n.t("goHighLevel.templates.dialogTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            size="small"
            label={i18n.t("goHighLevel.templates.name")}
            value={editando.name}
            onChange={(e) => setEditando({ ...editando, name: e.target.value })}
          />
          <TextField
            fullWidth
            margin="dense"
            variant="outlined"
            size="small"
            label={i18n.t("goHighLevel.templates.language")}
            value={editando.language}
            onChange={(e) =>
              setEditando({ ...editando, language: e.target.value })
            }
          />
          <TextField
            fullWidth
            multiline
            minRows={4}
            margin="dense"
            variant="outlined"
            size="small"
            label={i18n.t("goHighLevel.templates.body")}
            value={editando.body}
            onChange={(e) => setEditando({ ...editando, body: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogo(false)}>
            {i18n.t("goHighLevel.cancel")}
          </Button>
          <Button color="primary" variant="contained" onClick={guardarPlantilla}>
            {i18n.t("goHighLevel.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default GoHighLevel;
