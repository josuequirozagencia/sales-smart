import React, { useState, useEffect, useContext } from "react";

import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
} from "@material-ui/core";
import { useHistory } from "react-router-dom";
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
  // Igual que el token de GHL: el de Meta nunca vuelve del servidor, solo
  // sus 4 ultimos caracteres, y aqui solo se manda si se escribe uno nuevo.
  const [tokenMeta, setTokenMeta] = useState("");
  const history = useHistory();

  const esAdmin = user.profile === "admin";

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/ghl/config");
      setConfig(data);
    } catch (err) {
      toastError(err);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarConfig = async ({ quitarMeta = false } = {}) => {
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
        metaBusinessId: config.metaBusinessId || "",
        metaAccessToken: tokenMeta || undefined,
        quitarMeta,
      });
      setConfig(data);
      setToken("");
      setTokenMeta("");
      toast.success(i18n.t("goHighLevel.saved"));
    } catch (err) {
      toastError(err);
    }
    setGuardando(false);
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
        {/* La cola NO se elige aqui: es la de la conexion, como en el resto
            de canales. Un segundo selector seria un segundo sitio para
            configurar lo mismo. */}
        <div className={classes.ayuda}>
          {i18n.t("goHighLevel.connection.queueHelp")}
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
              onClick={() => guardarConfig()}
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
          <div className={classes.ayuda} style={{ marginTop: 16 }}>
            {i18n.t("goHighLevel.webhook.tagsHelp")}
          </div>
          {/* Van fuera de las traducciones a proposito: son claves tecnicas
              que hay que copiar tal cual, y las llaves de {{contact.id}}
              las interpretaria i18next como una variable propia. */}
          <div className={classes.url}>
            {"ghl_event = tag_update"}
            <br />
            {"contact_id = {{contact.id}}"}
          </div>
        </Paper>
      )}

      {/* --- Plantillas de WhatsApp (Meta) ---
          GHL no deja leer las plantillas por API, pero la cuenta de WhatsApp
          Business de detras es de Meta. Con estas dos credenciales se leen las
          plantillas reales y se ven en "Plantillas de WhatsApp". */}
      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.titulo}>{i18n.t("goHighLevel.meta.title")}</div>
        <div className={classes.ayuda}>{i18n.t("goHighLevel.meta.help")}</div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            label={i18n.t("goHighLevel.meta.businessId")}
            value={config.metaBusinessId || ""}
            onChange={(e) => setConfig({ ...config, metaBusinessId: e.target.value.replace(/\D/g, "") })}
            disabled={!esAdmin}
          />
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            type="password"
            autoComplete="new-password"
            label={i18n.t("goHighLevel.meta.token")}
            placeholder={
              config.tieneTokenMeta
                ? `${i18n.t("goHighLevel.meta.tokenSaved")} ••••${config.metaTokenLast4 || ""}`
                : ""
            }
            value={tokenMeta}
            onChange={(e) => setTokenMeta(e.target.value)}
            disabled={!esAdmin}
          />
        </div>

        <div className={classes.acciones} style={{ marginTop: 12, flexWrap: "wrap" }}>
          {esAdmin && (
            <Button variant="contained" color="primary" onClick={() => guardarConfig()} disabled={guardando}>
              {i18n.t("goHighLevel.save")}
            </Button>
          )}
          {config.tieneTokenMeta && config.metaBusinessId && (
            <Button variant="outlined" onClick={() => history.push("/whatsapp-templates")}>
              {i18n.t("goHighLevel.meta.viewTemplates")}
            </Button>
          )}
          {esAdmin && (config.tieneTokenMeta || config.metaBusinessId) && (
            <Button onClick={() => guardarConfig({ quitarMeta: true })} disabled={guardando}>
              {i18n.t("goHighLevel.meta.remove")}
            </Button>
          )}
        </div>
      </Paper>
    </MainContainer>
  );
};

export default GoHighLevel;
