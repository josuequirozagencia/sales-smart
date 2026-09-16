import React, { useEffect, useRef, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { DeleteOutline, Refresh, Visibility, VisibilityOff } from "@material-ui/icons";
import Alert from "@material-ui/lab/Alert";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Formulario de un Agente IA. Se usa estado propio y no Formik porque hay dos
// estructuras anidadas —el horario por dia y los pasos de seguimiento— que con
// Formik quedarian mas enrevesadas que el formulario en si.
//
// La clave de API nunca vuelve del servidor: si el agente ya tiene una, el
// campo queda vacio con sus 4 ultimos caracteres como pista, y solo se envia
// cuando se escribe una nueva.

const MAX_PASOS = 5;
const MAX_CONOCIMIENTO = 100000;

const DIAS = [0, 1, 2, 3, 4, 5, 6];

const vacio = {
  name: "",
  provider: "openai",
  model: "",
  apiKey: "",
  systemPrompt: "",
  temperature: 0.7,
  maxTokens: 1000,
  maxCharacters: "",
  maxMessages: 10,
  voice: "texto",
  voiceKey: "",
  voiceRegion: "",
  escuchaAudio: false,
  leeImagenes: false,
  dividirRespuestas: false,
  cantidadBloques: 2,
  knowledgeText: "",
  knowledgeFileName: null,
  schedule: { mode: "24/7", days: [] },
  followUps: [],
  transferQueueId: "",
  disponibleEnFlujos: false,
  isActive: true,
};

const horarioPorDefecto = () =>
  DIAS.map((day) => ({ day, enabled: day >= 1 && day <= 5, start: "09:00", end: "18:00" }));

const useStyles = makeStyles((theme) => ({
  contenido: { minHeight: 380 },
  seccion: { marginTop: theme.spacing(2) },
  ayuda: { color: theme.palette.text.secondary, display: "block", marginTop: theme.spacing(0.5) },
  paso: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    padding: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  canal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(0.5, 0),
  },
  botonGuardar: { position: "relative" },
  progreso: { position: "absolute", top: "50%", left: "50%", marginTop: -12, marginLeft: -12 },
}));

const AiAgentModal = ({ open, onClose, agentId }) => {
  const classes = useStyles();
  const [pestana, setPestana] = useState("general");
  const [datos, setDatos] = useState(vacio);
  const [keyLast4, setKeyLast4] = useState(null);
  const [voiceKeyLast4, setVoiceKeyLast4] = useState(null);
  const [verClave, setVerClave] = useState(false);
  const [colas, setColas] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [cargandoModelos, setCargandoModelos] = useState(false);
  const [avisoModelos, setAvisoModelos] = useState(null);
  const [error, setError] = useState(null);
  // Si el alta funciono pero fallaron los canales, al reintentar se edita ese
  // agente en vez de crear otro.
  const [idCreado, setIdCreado] = useState(null);
  const archivoRef = useRef();
  const id = agentId || idCreado;

  const cambiar = (campo, valor) => setDatos((previo) => ({ ...previo, [campo]: valor }));

  // Mensaje del servidor traducido; si el codigo no tiene traduccion se
  // muestra tal cual, antes que dejar al asesor sin explicacion.
  const mensajeDeError = (err) => {
    const codigo = err?.response?.data?.error;
    if (codigo) return i18n.exists(`backendErrors.${codigo}`) ? i18n.t(`backendErrors.${codigo}`) : codigo;
    if (err?.request && !err?.response) return i18n.t("backendErrors.ERR_NO_SERVER_RESPONSE");
    return err?.message || i18n.t("aiAgents.errors.generic");
  };

  /** Modelos que ofrece el proveedor. La clave va solo si se acaba de escribir. */
  const cargarModelos = async (proveedor = datos.provider, clave = datos.apiKey) => {
    setCargandoModelos(true);
    setAvisoModelos(null);
    try {
      const { data } = await api.post("/ai-agents/models", {
        provider: proveedor,
        apiKey: clave || undefined,
        agentId: agentId || idCreado || undefined,
      });
      setModelos(data.models || []);
      setAvisoModelos(data.avisos?.[0] || (data.models?.length ? null : "EMPTY"));
    } catch (err) {
      setModelos([]);
      setAvisoModelos("UNAVAILABLE");
    } finally {
      setCargandoModelos(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setPestana("general");
    setVerClave(false);
    setError(null);
    setIdCreado(null);
    setModelos([]);
    setAvisoModelos(null);
    (async () => {
      setCargando(true);
      try {
        const [{ data: listaColas }, { data: listaConexiones }] = await Promise.all([
          api.get("/queue"),
          api.get("/ai-agents/channels"),
        ]);
        setColas(listaColas || []);
        setConexiones(listaConexiones || []);

        if (agentId) {
          const { data } = await api.get(`/ai-agents/${agentId}`);
          setDatos({
            ...vacio,
            ...data,
            apiKey: "",
            voiceKey: "",
            maxCharacters: data.maxCharacters ?? "",
            transferQueueId: data.transferQueueId ?? "",
            schedule: {
              mode: data.schedule?.mode === "custom" ? "custom" : "24/7",
              days: data.schedule?.days?.length ? data.schedule.days : horarioPorDefecto(),
            },
            followUps: data.followUps || [],
          });
          setKeyLast4(data.keyLast4);
          setVoiceKeyLast4(data.voiceKeyLast4);
          setSeleccionadas((data.channels || []).map((c) => c.whatsappId));
          cargarModelos(data.provider, "");
        } else {
          setDatos({ ...vacio, schedule: { mode: "24/7", days: horarioPorDefecto() } });
          setKeyLast4(null);
          setVoiceKeyLast4(null);
          setSeleccionadas([]);
          // OpenRouter publica su catalogo sin clave: ese ya se puede listar.
          cargarModelos("openrouter", "");
        }
      } catch (err) {
        setError(mensajeDeError(err));
      } finally {
        setCargando(false);
      }
    })();
  }, [open, agentId]);

  const subirConocimiento = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("file", archivo);
    setSubiendo(true);
    try {
      const { data } = await api.post("/ai-agents/knowledge/extract", cuerpo, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDatos((previo) => ({ ...previo, knowledgeText: data.text, knowledgeFileName: data.fileName }));
      if (data.truncated) toast.warn(i18n.t("aiAgents.knowledge.truncated"));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setSubiendo(false);
    }
  };

  const cambiarDia = (day, campo, valor) =>
    setDatos((previo) => ({
      ...previo,
      schedule: {
        ...previo.schedule,
        days: previo.schedule.days.map((d) => (d.day === day ? { ...d, [campo]: valor } : d)),
      },
    }));

  const cambiarPaso = (indice, campo, valor) =>
    setDatos((previo) => ({
      ...previo,
      followUps: previo.followUps.map((p, i) =>
        i !== indice
          ? p
          : campo === "amount" || campo === "unit"
          ? { ...p, when: { ...p.when, [campo]: valor } }
          : { ...p, [campo]: valor }
      ),
    }));

  const anadirPaso = () =>
    setDatos((previo) => ({
      ...previo,
      followUps: [...previo.followUps, { when: { amount: 30, unit: "minutes" }, mode: "ia", content: "" }],
    }));

  const quitarPaso = (indice) =>
    setDatos((previo) => ({ ...previo, followUps: previo.followUps.filter((_, i) => i !== indice) }));

  const alternarConexion = (whatsappId) =>
    setSeleccionadas((previo) =>
      previo.includes(whatsappId) ? previo.filter((id) => id !== whatsappId) : [...previo, whatsappId]
    );

  const guardar = async () => {
    // Se comprueba antes de enviar para poder senalar el campo y la pestana.
    const faltan = [];
    if (!datos.name.trim()) faltan.push(i18n.t("aiAgents.form.name"));
    if (!datos.model.trim()) faltan.push(i18n.t("aiAgents.form.model"));
    if (!id && !datos.apiKey.trim()) faltan.push(i18n.t("aiAgents.form.apiKey"));
    if (faltan.length) {
      setPestana("general");
      setError(`${i18n.t("aiAgents.errors.required")}: ${faltan.join(", ")}`);
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        ...datos,
        maxCharacters: datos.maxCharacters === "" ? null : Number(datos.maxCharacters),
        transferQueueId: datos.transferQueueId === "" ? null : Number(datos.transferQueueId),
        schedule:
          datos.schedule.mode === "custom" ? { mode: "custom", days: datos.schedule.days } : { mode: "24/7" },
        followUps: datos.followUps.filter((p) => p.content?.trim()),
      };
      if (!cuerpo.apiKey) delete cuerpo.apiKey;
      if (!cuerpo.voiceKey) delete cuerpo.voiceKey;

      const { data } = id ? await api.put(`/ai-agents/${id}`, cuerpo) : await api.post("/ai-agents", cuerpo);
      setIdCreado(data.id);

      // Los canales van en su propia llamada: rechaza uno ya ocupado por otro
      // agente en vez de quitarselo en silencio.
      await api.put(`/ai-agents/${data.id}/channels`, { whatsappIds: seleccionadas });

      toast.success(i18n.t("aiAgents.toasts.saved"));
      onClose(true);
    } catch (err) {
      if (err?.response?.data?.error === "ERR_AI_AGENT_CHANNEL_TAKEN") setPestana("canales");
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaClave = keyLast4
    ? `${i18n.t("aiAgents.form.apiKeySaved")} ••••${keyLast4}`
    : i18n.t("aiAgents.form.apiKey");

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        {agentId ? i18n.t("aiAgents.modal.editTitle") : i18n.t("aiAgents.modal.addTitle")}
      </DialogTitle>
      <DialogContent dividers className={classes.contenido}>
        {/* El motivo del fallo se ve aqui y no solo en un aviso fugaz de la
            esquina, que con el formulario abierto pasa desapercibido. */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {cargando ? (
          <CircularProgress size={28} />
        ) : (
          <>
            <Tabs
              value={pestana}
              onChange={(e, valor) => setPestana(valor)}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label={i18n.t("aiAgents.tabs.general")} value="general" />
              <Tab label={i18n.t("aiAgents.tabs.behaviour")} value="comportamiento" />
              <Tab label={i18n.t("aiAgents.tabs.knowledge")} value="conocimiento" />
              <Tab label={i18n.t("aiAgents.tabs.schedule")} value="horario" />
              <Tab label={i18n.t("aiAgents.tabs.followUps")} value="seguimientos" />
              <Tab label={i18n.t("aiAgents.tabs.channels")} value="canales" />
            </Tabs>

            {pestana === "general" && (
              <Grid container spacing={2} className={classes.seccion}>
                <Grid item xs={12} md={8}>
                  <TextField
                    label={i18n.t("aiAgents.form.name")}
                    value={datos.name}
                    onChange={(e) => cambiar("name", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.isActive}
                        onChange={(e) => cambiar("isActive", e.target.checked)}
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.form.isActive")}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel>{i18n.t("aiAgents.form.provider")}</InputLabel>
                    <Select
                      value={datos.provider}
                      onChange={(e) => {
                        cambiar("provider", e.target.value);
                        cargarModelos(e.target.value, datos.apiKey);
                      }}
                      label={i18n.t("aiAgents.form.provider")}
                    >
                      <MenuItem value="openai">OpenAI</MenuItem>
                      <MenuItem value="gemini">Google Gemini</MenuItem>
                      <MenuItem value="openrouter">OpenRouter</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={8}>
                  {/* Desplegable con lo que publica el proveedor, pero sigue
                      aceptando texto: un modelo recien salido no espera a que
                      alguien actualice una lista escrita a mano. */}
                  <Autocomplete
                    freeSolo
                    openOnFocus
                    options={modelos}
                    loading={cargandoModelos}
                    value={datos.model}
                    inputValue={datos.model}
                    onChange={(e, valor) => cambiar("model", valor || "")}
                    onInputChange={(e, valor) => cambiar("model", valor || "")}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={i18n.t("aiAgents.form.model")}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        helperText={
                          avisoModelos
                            ? i18n.t(`aiAgents.models.${avisoModelos}`)
                            : i18n.t(`aiAgents.form.modelHint.${datos.provider}`)
                        }
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {cargandoModelos ? <CircularProgress size={16} /> : null}
                              <Tooltip title={i18n.t("aiAgents.models.refresh")}>
                                <IconButton size="small" onClick={() => cargarModelos()} disabled={cargandoModelos}>
                                  <Refresh fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={etiquetaClave}
                    value={datos.apiKey}
                    onChange={(e) => cambiar("apiKey", e.target.value)}
                    onBlur={(e) => e.target.value.trim() && cargarModelos(datos.provider, e.target.value)}
                    type={verClave ? "text" : "password"}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    autoComplete="new-password"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setVerClave(!verClave)}>
                            {verClave ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Typography variant="caption" className={classes.ayuda}>
                    {i18n.t("aiAgents.form.apiKeyHelp")}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={i18n.t("aiAgents.form.systemPrompt")}
                    value={datos.systemPrompt}
                    onChange={(e) => cambiar("systemPrompt", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={8}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel>{i18n.t("aiAgents.form.transferQueue")}</InputLabel>
                    <Select
                      value={datos.transferQueueId}
                      onChange={(e) => cambiar("transferQueueId", e.target.value)}
                      label={i18n.t("aiAgents.form.transferQueue")}
                    >
                      <MenuItem value="">{i18n.t("aiAgents.form.noQueue")}</MenuItem>
                      {colas.map((cola) => (
                        <MenuItem key={cola.id} value={cola.id}>
                          {cola.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" className={classes.ayuda}>
                    {i18n.t("aiAgents.form.transferQueueHelp")}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.disponibleEnFlujos}
                        onChange={(e) => cambiar("disponibleEnFlujos", e.target.checked)}
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.form.availableInFlows")}
                  />
                </Grid>
              </Grid>
            )}

            {pestana === "comportamiento" && (
              <Grid container spacing={2} className={classes.seccion}>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={i18n.t("aiAgents.form.temperature")}
                    value={datos.temperature}
                    onChange={(e) => cambiar("temperature", e.target.value)}
                    type="number"
                    inputProps={{ min: 0, max: 2, step: 0.1 }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={i18n.t("aiAgents.form.maxTokens")}
                    value={datos.maxTokens}
                    onChange={(e) => cambiar("maxTokens", e.target.value)}
                    type="number"
                    inputProps={{ min: 1, max: 32000 }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={i18n.t("aiAgents.form.maxCharacters")}
                    value={datos.maxCharacters}
                    onChange={(e) => cambiar("maxCharacters", e.target.value)}
                    type="number"
                    inputProps={{ min: 20, max: 10000 }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    helperText={i18n.t("aiAgents.form.maxCharactersHelp")}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label={i18n.t("aiAgents.form.maxMessages")}
                    value={datos.maxMessages}
                    onChange={(e) => cambiar("maxMessages", e.target.value)}
                    type="number"
                    inputProps={{ min: 0, max: 50 }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    helperText={i18n.t("aiAgents.form.maxMessagesHelp")}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.dividirRespuestas}
                        onChange={(e) => cambiar("dividirRespuestas", e.target.checked)}
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.form.splitAnswers")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl variant="outlined" margin="dense" fullWidth disabled={!datos.dividirRespuestas}>
                    <InputLabel>{i18n.t("aiAgents.form.blocks")}</InputLabel>
                    <Select
                      value={datos.cantidadBloques}
                      onChange={(e) => cambiar("cantidadBloques", e.target.value)}
                      label={i18n.t("aiAgents.form.blocks")}
                    >
                      {[1, 2, 3].map((n) => (
                        <MenuItem key={n} value={n}>
                          {n}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.escuchaAudio}
                        onChange={(e) => cambiar("escuchaAudio", e.target.checked)}
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.form.listensAudio")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.leeImagenes}
                        onChange={(e) => cambiar("leeImagenes", e.target.checked)}
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.form.readsImages")}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                  <Typography variant="subtitle2" className={classes.seccion}>
                    {i18n.t("aiAgents.form.voiceSection")}
                  </Typography>
                  <Typography variant="caption" className={classes.ayuda}>
                    {i18n.t("aiAgents.form.voiceHelp")}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={i18n.t("aiAgents.form.voice")}
                    value={datos.voice}
                    onChange={(e) => cambiar("voice", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    helperText={i18n.t("aiAgents.form.voiceFieldHelp")}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={
                      voiceKeyLast4
                        ? `${i18n.t("aiAgents.form.voiceKeySaved")} ••••${voiceKeyLast4}`
                        : i18n.t("aiAgents.form.voiceKey")
                    }
                    value={datos.voiceKey}
                    onChange={(e) => cambiar("voiceKey", e.target.value)}
                    type="password"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    autoComplete="new-password"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={i18n.t("aiAgents.form.voiceRegion")}
                    value={datos.voiceRegion}
                    onChange={(e) => cambiar("voiceRegion", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
              </Grid>
            )}

            {pestana === "conocimiento" && (
              <Grid container spacing={2} className={classes.seccion}>
                <Grid item xs={12}>
                  <Typography variant="caption" className={classes.ayuda}>
                    {i18n.t("aiAgents.knowledge.help")}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <input
                    type="file"
                    hidden
                    ref={archivoRef}
                    accept=".pdf,.doc,.docx,.txt,.md,.csv"
                    onChange={subirConocimiento}
                  />
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={subiendo}
                    onClick={() => archivoRef.current?.click()}
                  >
                    {subiendo ? i18n.t("aiAgents.knowledge.reading") : i18n.t("aiAgents.knowledge.upload")}
                  </Button>
                  {datos.knowledgeFileName && (
                    <Typography variant="caption" className={classes.ayuda}>
                      {i18n.t("aiAgents.knowledge.fromFile")}: {datos.knowledgeFileName}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={i18n.t("aiAgents.knowledge.text")}
                    value={datos.knowledgeText}
                    onChange={(e) => cambiar("knowledgeText", e.target.value)}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={12}
                    helperText={`${(datos.knowledgeText || "").length} / ${MAX_CONOCIMIENTO}`}
                  />
                </Grid>
              </Grid>
            )}

            {pestana === "horario" && (
              <Grid container spacing={2} className={classes.seccion}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={datos.schedule.mode === "24/7"}
                        onChange={(e) =>
                          cambiar("schedule", {
                            ...datos.schedule,
                            mode: e.target.checked ? "24/7" : "custom",
                          })
                        }
                        color="primary"
                      />
                    }
                    label={i18n.t("aiAgents.schedule.always")}
                  />
                  <Typography variant="caption" className={classes.ayuda}>
                    {i18n.t("aiAgents.schedule.help")}
                  </Typography>
                </Grid>
                {datos.schedule.mode === "custom" &&
                  datos.schedule.days.map((dia) => (
                    <Grid container spacing={1} key={dia.day} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={dia.enabled}
                              onChange={(e) => cambiarDia(dia.day, "enabled", e.target.checked)}
                              color="primary"
                            />
                          }
                          label={i18n.t(`aiAgents.schedule.days.${dia.day}`)}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          type="time"
                          value={dia.start}
                          onChange={(e) => cambiarDia(dia.day, "start", e.target.value)}
                          disabled={!dia.enabled}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          label={i18n.t("aiAgents.schedule.from")}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <TextField
                          type="time"
                          value={dia.end}
                          onChange={(e) => cambiarDia(dia.day, "end", e.target.value)}
                          disabled={!dia.enabled}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          label={i18n.t("aiAgents.schedule.to")}
                        />
                      </Grid>
                    </Grid>
                  ))}
              </Grid>
            )}

            {pestana === "seguimientos" && (
              <div className={classes.seccion}>
                <Typography variant="caption" className={classes.ayuda}>
                  {i18n.t("aiAgents.followUps.help")}
                </Typography>
                {datos.followUps.map((paso, indice) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className={classes.paso} key={indice}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={4} md={2}>
                        <TextField
                          label={i18n.t("aiAgents.followUps.after")}
                          value={paso.when.amount}
                          onChange={(e) => cambiarPaso(indice, "amount", Number(e.target.value))}
                          type="number"
                          inputProps={{ min: 1 }}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={8} md={3}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("aiAgents.followUps.unit")}</InputLabel>
                          <Select
                            value={paso.when.unit}
                            onChange={(e) => cambiarPaso(indice, "unit", e.target.value)}
                            label={i18n.t("aiAgents.followUps.unit")}
                          >
                            <MenuItem value="minutes">{i18n.t("aiAgents.followUps.minutes")}</MenuItem>
                            <MenuItem value="hours">{i18n.t("aiAgents.followUps.hours")}</MenuItem>
                            <MenuItem value="days">{i18n.t("aiAgents.followUps.days")}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={10} md={5}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("aiAgents.followUps.mode")}</InputLabel>
                          <Select
                            value={paso.mode}
                            onChange={(e) => cambiarPaso(indice, "mode", e.target.value)}
                            label={i18n.t("aiAgents.followUps.mode")}
                          >
                            <MenuItem value="ia">{i18n.t("aiAgents.followUps.modeIa")}</MenuItem>
                            <MenuItem value="manual">{i18n.t("aiAgents.followUps.modeManual")}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={2} md={2} style={{ textAlign: "right" }}>
                        <IconButton size="small" onClick={() => quitarPaso(indice)}>
                          <DeleteOutline />
                        </IconButton>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label={i18n.t(
                            paso.mode === "manual"
                              ? "aiAgents.followUps.contentManual"
                              : "aiAgents.followUps.contentIa"
                          )}
                          value={paso.content}
                          onChange={(e) => cambiarPaso(indice, "content", e.target.value)}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          multiline
                          rows={2}
                        />
                      </Grid>
                    </Grid>
                  </div>
                ))}
                {datos.followUps.length < MAX_PASOS && (
                  <Button className={classes.seccion} variant="outlined" color="primary" onClick={anadirPaso}>
                    {i18n.t("aiAgents.followUps.add")}
                  </Button>
                )}
              </div>
            )}

            {pestana === "canales" && (
              <div className={classes.seccion}>
                <Typography variant="caption" className={classes.ayuda}>
                  {i18n.t("aiAgents.channels.help")}
                </Typography>
                {conexiones.length === 0 && (
                  <Typography variant="body2" className={classes.seccion}>
                    {i18n.t("aiAgents.channels.empty")}
                  </Typography>
                )}
                {conexiones.map((conexion) => {
                  const deOtro = conexion.agentId && conexion.agentId !== agentId;
                  return (
                    <div className={classes.canal} key={conexion.whatsappId}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={seleccionadas.includes(conexion.whatsappId)}
                            onChange={() => alternarConexion(conexion.whatsappId)}
                            disabled={deOtro}
                            color="primary"
                          />
                        }
                        label={`${conexion.name} · ${conexion.channel}`}
                      />
                      {deOtro && (
                        <Typography variant="caption" className={classes.ayuda}>
                          {i18n.t("aiAgents.channels.taken")}: {conexion.agentName}
                        </Typography>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="secondary" disabled={guardando}>
          {i18n.t("aiAgents.buttons.cancel")}
        </Button>
        <div className={classes.botonGuardar}>
          <Button onClick={guardar} color="primary" variant="contained" disabled={guardando || cargando}>
            {i18n.t("aiAgents.buttons.save")}
          </Button>
          {guardando && <CircularProgress size={24} className={classes.progreso} />}
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default AiAgentModal;
