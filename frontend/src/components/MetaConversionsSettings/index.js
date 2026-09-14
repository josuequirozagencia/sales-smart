import React, { useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useDate } from "../../hooks/useDate";

/**
 * Configuracion > Integraciones > Meta (Conversions API).
 *
 * Mismo patron que la pantalla de GoHighLevel: el token guardado NUNCA
 * vuelve del servidor; el campo empieza vacio y solo se manda si se escribe
 * algo. El servidor devuelve si hay token y sus 4 ultimos caracteres. Solo
 * para administradores, y siempre sobre la propia empresa. Ver
 * docs/META_CONVERSIONS_API.md.
 */

const useStyles = makeStyles((theme) => ({
  bloque: {
    padding: theme.palette.tokens.space.lg,
    marginBottom: theme.palette.tokens.space.lg,
    borderRadius: theme.palette.tokens.radius.lg,
    width: "100%",
  },
  cabecera: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.palette.tokens.space.md,
    flexWrap: "wrap",
    marginBottom: theme.palette.tokens.space.xs,
  },
  titulo: {
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: theme.palette.tokens.text.primary,
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
  lista: {
    margin: 0,
    paddingLeft: 18,
    fontSize: "0.8125rem",
    lineHeight: 1.6,
    color: theme.palette.tokens.text.secondary,
  },
  estado: {
    display: "inline-block",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: theme.palette.tokens.radius.sm,
  },
  estadoOk: {
    color: theme.palette.tokens.semantic.success.text,
    backgroundColor: theme.palette.tokens.semantic.success.soft,
  },
  estadoError: {
    color: theme.palette.tokens.semantic.error.text,
    backgroundColor: theme.palette.tokens.semantic.error.soft,
  },
  estadoPendiente: {
    color: theme.palette.tokens.semantic.warning.text,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
  },
  estadoNeutro: {
    color: theme.palette.tokens.text.secondary,
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
  },
  detalle: {
    fontSize: "0.75rem",
    color: theme.palette.tokens.text.secondary,
    marginTop: theme.palette.tokens.space.sm,
  },
  errorTexto: {
    fontSize: "0.8125rem",
    color: theme.palette.tokens.semantic.error.text,
    marginTop: theme.palette.tokens.space.sm,
    wordBreak: "break-word",
  },
  acciones: {
    display: "flex",
    justifyContent: "flex-end",
  },
}));

const SIN_ESCAPAR = { interpolation: { escapeValue: false } };

const listaTraducida = (clave) => {
  const valor = i18n.t(clave, { returnObjects: true });
  return Array.isArray(valor) ? valor : [];
};

const MetaConversionsSettings = () => {
  const classes = useStyles();
  const { datetimeToClient } = useDate();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [config, setConfig] = useState(null);
  const [datasetId, setDatasetId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  // El token guardado nunca vuelve: este campo empieza vacio siempre.
  const [token, setToken] = useState("");

  const aplicar = (data) => {
    setConfig(data);
    setDatasetId(data.datasetId || "");
    setTestEventCode(data.testEventCode || "");
    setIsActive(data.configured ? data.isActive : true);
    setToken("");
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/meta/config");
        aplicar(data);
      } catch (err) {
        toastError(err);
      }
      setCargando(false);
    })();
  }, []);

  const guardar = async () => {
    if (!/^\d{5,25}$/.test(datasetId.trim())) {
      toast.error(i18n.t("backendErrors.ERR_META_INVALID_DATASET"));
      return;
    }
    if (!config?.hasToken && !token.trim()) {
      toast.error(i18n.t("backendErrors.ERR_META_TOKEN_REQUIRED"));
      return;
    }

    setGuardando(true);
    try {
      const { data } = await api.put("/meta/config", {
        datasetId: datasetId.trim(),
        accessToken: token.trim() || undefined,
        testEventCode: testEventCode.trim(),
        isActive,
      });
      aplicar(data);
      if (data.status === "error") {
        toast.warning(i18n.t("metaConversions.savedWithError"));
      } else {
        toast.success(i18n.t("metaConversions.saved"));
      }
    } catch (err) {
      toastError(err);
    }
    setGuardando(false);
  };

  if (cargando) {
    return <CircularProgress size={24} />;
  }

  const estado = config?.status || "not_configured";
  const claseEstado = {
    ok: classes.estadoOk,
    error: classes.estadoError,
    unverified: classes.estadoPendiente,
  }[estado] || classes.estadoNeutro;

  return (
    <div style={{ width: "100%" }}>
      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.cabecera}>
          <div className={classes.titulo}>{i18n.t("metaConversions.title")}</div>
          <span className={`${classes.estado} ${claseEstado}`}>
            {i18n.t(`metaConversions.status.${estado}`)}
          </span>
        </div>
        <div className={classes.ayuda}>{i18n.t("metaConversions.help")}</div>

        {config?.lastError && estado !== "ok" && (
          <div className={classes.errorTexto}>
            {i18n.t("metaConversions.lastError", { error: config.lastError, ...SIN_ESCAPAR })}
          </div>
        )}
        {(config?.lastSuccessAt || config?.verifiedAt) && (
          <div className={classes.detalle}>
            {config.lastSuccessAt
              ? i18n.t("metaConversions.lastSuccess", { when: datetimeToClient(config.lastSuccessAt) })
              : i18n.t("metaConversions.verified", { when: datetimeToClient(config.verifiedAt) })}
          </div>
        )}
      </Paper>

      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.titulo}>{i18n.t("metaConversions.credentialsTitle")}</div>
        <div className={classes.ayuda}>{i18n.t("metaConversions.credentialsHelp")}</div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            required
            label={i18n.t("metaConversions.fields.datasetId")}
            helperText={i18n.t("metaConversions.fields.datasetIdHelp")}
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            disabled={guardando}
          />
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            type="password"
            // Sin esto el navegador ofrece guardar o rellenar el token.
            autoComplete="new-password"
            required={!config?.hasToken}
            label={i18n.t("metaConversions.fields.token")}
            helperText={
              config?.hasToken
                ? i18n.t("metaConversions.fields.tokenSaved", { last4: config.tokenLast4 || "····" })
                : i18n.t("metaConversions.fields.tokenHelp")
            }
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={guardando}
          />
        </div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            label={i18n.t("metaConversions.fields.testEventCode")}
            helperText={i18n.t("metaConversions.fields.testEventCodeHelp")}
            value={testEventCode}
            onChange={(e) => setTestEventCode(e.target.value)}
            disabled={guardando}
          />
          <div className={classes.campo}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={guardando}
                />
              }
              label={i18n.t("metaConversions.fields.active")}
            />
          </div>
        </div>

        <div className={classes.acciones}>
          <Button variant="contained" color="primary" onClick={guardar} disabled={guardando}>
            {guardando ? <CircularProgress size={18} /> : i18n.t("metaConversions.save")}
          </Button>
        </div>
      </Paper>

      <Paper className={classes.bloque} variant="outlined">
        <div className={classes.titulo}>{i18n.t("metaConversions.eventsTitle")}</div>
        <ul className={classes.lista}>
          {listaTraducida("metaConversions.events").map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className={classes.titulo} style={{ marginTop: 12 }}>
          {i18n.t("metaConversions.requirementsTitle")}
        </div>
        <ul className={classes.lista}>
          {listaTraducida("metaConversions.requirements").map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Paper>
    </div>
  );
};

export default MetaConversionsSettings;
