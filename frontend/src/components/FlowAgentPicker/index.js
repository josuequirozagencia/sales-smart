import React, { useEffect, useState } from "react";
import * as Yup from "yup";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@material-ui/core";
import { ExpandMore } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Nodo de IA del Flow Builder con un Agente IA ya creado. El nodo guarda solo
// el id del agente: proveedor, modelo, clave e instrucciones se leen del
// agente al responder, asi que cambiar el agente cambia todos sus flujos y la
// clave nunca queda escrita en el JSON del flujo. La configuracion manual de
// siempre sigue disponible.

/** Agentes disponibles para flujos (solo id, nombre, proveedor y modelo). */
export const useAgentesDeFlujo = (abierto) => {
  const [agentes, setAgentes] = useState([]);
  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;
    api
      .get("/ai-agents/flow-options")
      .then(({ data }) => vigente && setAgentes(Array.isArray(data) ? data : []))
      .catch(() => vigente && setAgentes([]));
    return () => {
      vigente = false;
    };
  }, [abierto]);
  return agentes;
};

/** Validacion del nodo cuando usa un agente: solo lo propio del flujo. */
export const esquemaNodoAgente = Yup.object().shape({
  agentId: Yup.number().required(),
  flowMode: Yup.string().oneOf(["permanent", "temporary"]).required(),
  maxInteractions: Yup.number().nullable(),
  completionTimeout: Yup.number().nullable(),
  continueKeywords: Yup.array().when("flowMode", {
    is: "temporary",
    then: Yup.array().of(Yup.string().required()).min(1),
    otherwise: Yup.array(),
  }),
  objective: Yup.string().when(["flowMode", "autoCompleteOnObjective"], {
    is: (flowMode, auto) => flowMode === "temporary" && auto,
    then: Yup.string().required(),
    otherwise: Yup.string(),
  }),
});

/** Lo que se guarda en el nodo cuando usa un agente: nada de claves ni prompt. */
export const datosNodoAgente = (values, agentes, provider) => {
  const agente = agentes.find((a) => a.id === Number(values.agentId));
  const temporal = values.flowMode === "temporary";
  return {
    agentId: Number(values.agentId),
    name: agente?.name || values.name || "",
    provider,
    queueId: values.queueId || 0,
    flowMode: values.flowMode,
    maxInteractions: temporal ? values.maxInteractions : null,
    completionTimeout: temporal ? values.completionTimeout : null,
    continueKeywords: temporal ? values.continueKeywords : [],
    objective: temporal ? values.objective : "",
    autoCompleteOnObjective: temporal ? values.autoCompleteOnObjective : false,
  };
};

const FlowAgentPicker = ({ agentes, value, onChange, className, summaryClassName, titleClassName }) => {
  const elegido = agentes.find((a) => a.id === Number(value));
  return (
    <Accordion className={className} defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMore />} className={summaryClassName}>
        <Typography className={titleClassName}>🤖 {i18n.t("flowAgentPicker.title")}</Typography>
      </AccordionSummary>
      <AccordionDetails style={{ flexDirection: "column" }}>
        <FormControl fullWidth margin="dense" variant="outlined">
          <InputLabel>{i18n.t("flowAgentPicker.label")}</InputLabel>
          <Select
            value={value || ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            label={i18n.t("flowAgentPicker.label")}
          >
            <MenuItem value="">{i18n.t("flowAgentPicker.manual")}</MenuItem>
            {agentes.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name} · {a.provider} · {a.model}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="textSecondary">
          {elegido
            ? i18n.t("flowAgentPicker.usingAgent", { name: elegido.name })
            : agentes.length
            ? i18n.t("flowAgentPicker.manualHelp")
            : i18n.t("flowAgentPicker.noAgents")}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
};

export default FlowAgentPicker;
