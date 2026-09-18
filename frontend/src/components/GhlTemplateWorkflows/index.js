import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Button,
  CircularProgress,
  FormControl,
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
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Plantilla de WhatsApp -> Workflow de GHL que la envia.
//
// GHL no documenta como enviar una plantilla aprobada por su API de mensajes;
// la via documentada es un Workflow con la accion "Send WhatsApp". Aqui se
// elige, para cada plantilla real (leida de Meta), el Workflow que la envia
// y en que campo personalizado del contacto va cada variable {{n}}: el
// Workflow de GHL debe usar esos mismos campos al rellenar la plantilla.

const useStyles = makeStyles((theme) => ({
  bloque: { padding: 16, marginBottom: 16 },
  titulo: { fontWeight: 600, marginBottom: 4 },
  ayuda: { color: theme.palette.text.secondary, fontSize: "0.8125rem", marginBottom: 12 },
  selector: { minWidth: 200 },
  variables: { display: "flex", flexDirection: "column", gap: 8 },
  motivo: { color: theme.palette.text.secondary, fontSize: "0.75rem" },
}));

const claveDe = (p) => `${p.name}|${p.language}`;

const GhlTemplateWorkflows = () => {
  const classes = useStyles();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [plantillas, setPlantillas] = useState([]);
  const [flujos, setFlujos] = useState([]);
  const [campos, setCampos] = useState({ disponible: false, campos: [] });
  // clave "nombre|idioma" -> { workflowId, workflowName, fields: { "body.1": { id | key } } }
  const [mapa, setMapa] = useState({});
  const [guardando, setGuardando] = useState(false);

  const mensajeDeError = (err) => {
    const codigo = err?.response?.data?.error;
    return codigo && i18n.exists(`backendErrors.${codigo}`) ? i18n.t(`backendErrors.${codigo}`) : codigo || err?.message;
  };

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [{ data: config }, { data: listaFlujos }, { data: listaCampos }] = await Promise.all([
          api.get("/ghl/template-workflows"),
          api.get("/ghl/workflows"),
          api.get("/ghl/custom-fields"),
        ]);
        setPlantillas(config.plantillas || []);
        setFlujos(listaFlujos?.workflows || []);
        setCampos(listaCampos || { disponible: false, campos: [] });
        const inicial = {};
        (config.mapa || []).forEach((m) => {
          inicial[claveDe(m)] = { workflowId: m.workflowId, workflowName: m.workflowName, fields: m.fields || {} };
        });
        setMapa(inicial);
      } catch (err) {
        setError(mensajeDeError(err));
      } finally {
        setCargando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarFlujo = (plantilla, workflowId) => {
    const flujo = flujos.find((f) => f.id === workflowId);
    setMapa((previo) => ({
      ...previo,
      [claveDe(plantilla)]: {
        ...(previo[claveDe(plantilla)] || { fields: {} }),
        workflowId,
        workflowName: flujo?.name || "",
      },
    }));
  };

  const cambiarCampo = (plantilla, variable, campo) => {
    setMapa((previo) => {
      const actual = previo[claveDe(plantilla)] || { workflowId: "", fields: {} };
      return { ...previo, [claveDe(plantilla)]: { ...actual, fields: { ...actual.fields, [variable]: campo } } };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const lista = plantillas
        .filter((p) => mapa[claveDe(p)]?.workflowId)
        .map((p) => ({ name: p.name, language: p.language, ...mapa[claveDe(p)] }));
      await api.put("/ghl/template-workflows", { mapa: lista });
      toast.success(i18n.t("goHighLevel.templateWorkflows.saved"));
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaVariable = (variable) => {
    const [parte, n] = variable.split(".");
    return `${i18n.t(`goHighLevel.templateWorkflows.parts.${parte}`)} {{${n}}}`;
  };

  return (
    <Paper className={classes.bloque} variant="outlined">
      <div className={classes.titulo}>{i18n.t("goHighLevel.templateWorkflows.title")}</div>
      <div className={classes.ayuda}>{i18n.t("goHighLevel.templateWorkflows.help")}</div>

      {cargando && <CircularProgress size={24} />}
      {error && <Alert severity="warning">{error}</Alert>}
      {!cargando && !error && !campos.disponible && (
        <Alert severity="info" style={{ marginBottom: 12 }}>
          {i18n.t("goHighLevel.templateWorkflows.fieldsUnavailable")}
        </Alert>
      )}

      {!cargando && !error && (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("goHighLevel.templateWorkflows.template")}</TableCell>
                <TableCell>{i18n.t("goHighLevel.templateWorkflows.workflow")}</TableCell>
                <TableCell>{i18n.t("goHighLevel.templateWorkflows.variables")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plantillas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>{i18n.t("goHighLevel.templateWorkflows.empty")}</TableCell>
                </TableRow>
              )}
              {plantillas.map((p) => {
                const asignada = mapa[claveDe(p)] || { workflowId: "", fields: {} };
                const noSoportada = ["HEADER_MEDIA", "BUTTON_VARIABLES"].includes(p.motivo);
                return (
                  <TableRow key={claveDe(p)}>
                    <TableCell>
                      <Typography variant="body2">{p.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {p.language} · {p.category}
                      </Typography>
                      {noSoportada && (
                        <div className={classes.motivo}>{i18n.t(`goHighLevel.templateWorkflows.reasons.${p.motivo}`)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl variant="outlined" size="small" className={classes.selector} disabled={noSoportada}>
                        <InputLabel>{i18n.t("goHighLevel.templateWorkflows.workflow")}</InputLabel>
                        <Select
                          value={asignada.workflowId || ""}
                          onChange={(e) => cambiarFlujo(p, e.target.value)}
                          label={i18n.t("goHighLevel.templateWorkflows.workflow")}
                        >
                          <MenuItem value="">{i18n.t("goHighLevel.templateWorkflows.none")}</MenuItem>
                          {flujos.map((f) => (
                            <MenuItem key={f.id} value={f.id}>
                              {f.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <div className={classes.variables}>
                        {(p.variables || []).length === 0 && (
                          <Typography variant="caption" color="textSecondary">
                            {i18n.t("goHighLevel.templateWorkflows.noVariables")}
                          </Typography>
                        )}
                        {(p.variables || []).map((variable) => {
                          const elegido = asignada.fields?.[variable] || {};
                          return campos.disponible ? (
                            <FormControl key={variable} variant="outlined" size="small" className={classes.selector} disabled={noSoportada}>
                              <InputLabel>{etiquetaVariable(variable)}</InputLabel>
                              <Select
                                value={elegido.id || ""}
                                onChange={(e) => cambiarCampo(p, variable, e.target.value ? { id: e.target.value } : {})}
                                label={etiquetaVariable(variable)}
                              >
                                <MenuItem value="">{i18n.t("goHighLevel.templateWorkflows.none")}</MenuItem>
                                {campos.campos.map((c) => (
                                  <MenuItem key={c.id} value={c.id}>
                                    {c.name} ({c.fieldKey})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <TextField
                              key={variable}
                              size="small"
                              variant="outlined"
                              label={etiquetaVariable(variable)}
                              placeholder="contact.nombre_del_campo"
                              value={elegido.key || ""}
                              onChange={(e) => cambiarCampo(p, variable, e.target.value ? { key: e.target.value } : {})}
                              disabled={noSoportada}
                            />
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div style={{ marginTop: 12 }}>
            <Button variant="contained" color="primary" onClick={guardar} disabled={guardando}>
              {i18n.t("goHighLevel.save")}
            </Button>
          </div>
        </>
      )}
    </Paper>
  );
};

export default GhlTemplateWorkflows;
