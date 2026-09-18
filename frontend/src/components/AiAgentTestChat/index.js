import React, { useEffect, useRef, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Button, Chip, CircularProgress, IconButton, TextField, Tooltip, Typography } from "@material-ui/core";
import { Image as ImageIcon, Mic, Refresh, Send, Stop } from "@material-ui/icons";
import Alert from "@material-ui/lab/Alert";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

// Chat de prueba del Agente IA. Usa la configuracion que hay en el formulario,
// aunque no este guardada, y responde con la misma logica que en produccion.
// No crea contactos, conversaciones ni mensajes: el historial lo guarda el
// servidor aparte y caduca solo.

const nuevaSesion = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const useStyles = makeStyles((theme) => ({
  raiz: { display: "flex", flexDirection: "column", height: 440, marginTop: theme.spacing(2) },
  barra: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1), marginBottom: theme.spacing(1) },
  hilo: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.default,
  },
  fila: { display: "flex", marginBottom: theme.spacing(1) },
  delCliente: { justifyContent: "flex-end" },
  burbuja: {
    maxWidth: "78%",
    padding: theme.spacing(0.75, 1.25),
    borderRadius: 10,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "0.875rem",
  },
  burbujaCliente: { backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText },
  burbujaAgente: { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` },
  nota: { color: theme.palette.text.secondary, display: "block", textAlign: "center", margin: theme.spacing(0.5, 0) },
  entrada: { display: "flex", alignItems: "flex-end", gap: theme.spacing(0.5), marginTop: theme.spacing(1) },
  vacio: { color: theme.palette.text.secondary, textAlign: "center", marginTop: theme.spacing(6) },
}));

const Capacidad = ({ etiqueta, valor }) => (
  <Chip
    size="small"
    variant="outlined"
    label={`${etiqueta}: ${
      valor === true
        ? i18n.t("aiAgents.test.yes")
        : valor === false
        ? i18n.t("aiAgents.test.no")
        : i18n.t("aiAgents.test.unknown")
    }`}
  />
);

const AiAgentTestChat = ({ datos, agentId, mensajeDeError }) => {
  const classes = useStyles();
  const [sesion, setSesion] = useState(nuevaSesion);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [capacidades, setCapacidades] = useState(null);
  const [comprobando, setComprobando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const grabadora = useRef(null);
  const trozos = useRef([]);
  const imagenRef = useRef();
  const finRef = useRef();

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Al cerrar el formulario se borra el historial de prueba del servidor.
  useEffect(
    () => () => {
      api.delete(`/ai-agents/test-message/${sesion}`).catch(() => undefined);
    },
    [sesion]
  );

  const config = () => {
    const c = { ...datos };
    if (!c.apiKey) delete c.apiKey;
    if (!c.voiceKey) delete c.voiceKey;
    c.maxCharacters = c.maxCharacters === "" ? null : c.maxCharacters;
    c.transferQueueId = c.transferQueueId === "" ? null : c.transferQueueId;
    c.schedule = c.schedule?.mode === "custom" ? c.schedule : { mode: "24/7" };
    c.followUps = (c.followUps || []).filter((p) => p.content?.trim());
    return c;
  };

  const enviar = async ({ imagen, audio } = {}) => {
    const escrito = texto.trim();
    if (!escrito && !imagen && !audio) return;
    const cuerpo = new FormData();
    cuerpo.append("sessionId", sesion);
    cuerpo.append("config", JSON.stringify(config()));
    if (agentId) cuerpo.append("agentId", String(agentId));
    if (escrito) cuerpo.append("text", escrito);
    if (imagen) cuerpo.append("image", imagen);
    if (audio) cuerpo.append("audio", audio, "grabacion.webm");

    const etiqueta = [imagen ? `🖼️ ${imagen.name}` : "", audio ? "🎤 audio" : "", escrito].filter(Boolean).join(" ");
    setMensajes((previo) => [...previo, { de: "cliente", texto: etiqueta }]);
    setTexto("");
    setEnviando(true);
    setError(null);
    try {
      const { data } = await api.post("/ai-agents/test-message", cuerpo, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const nuevos = [];
      if (data.transcripcion) nuevos.push({ de: "nota", texto: `${i18n.t("aiAgents.test.heard")}: «${data.transcripcion}»` });
      (data.bloques || []).forEach((b) => nuevos.push({ de: "agente", texto: b }));
      (data.avisos || []).forEach((a) =>
        nuevos.push({
          de: "nota",
          texto: i18n.exists(`aiAgents.test.notices.${a}`) ? i18n.t(`aiAgents.test.notices.${a}`) : a,
        })
      );
      if (data.transferir) nuevos.push({ de: "nota", texto: i18n.t("aiAgents.test.wouldTransfer") });
      if (!nuevos.length) nuevos.push({ de: "nota", texto: i18n.t("aiAgents.test.noReply") });
      setMensajes((previo) => [...previo, ...nuevos]);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = async () => {
    await api.delete(`/ai-agents/test-message/${sesion}`).catch(() => undefined);
    setSesion(nuevaSesion());
    setMensajes([]);
    setError(null);
  };

  const comprobar = async () => {
    setComprobando(true);
    setError(null);
    try {
      const { data } = await api.post("/ai-agents/capabilities", { config: config(), agentId: agentId || undefined });
      setCapacidades(data);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setComprobando(false);
    }
  };

  const alternarGrabacion = async () => {
    if (grabando) {
      grabadora.current?.stop();
      return;
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(flujo);
      trozos.current = [];
      rec.ondataavailable = (e) => e.data.size && trozos.current.push(e.data);
      rec.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        const audio = new Blob(trozos.current, { type: rec.mimeType || "audio/webm" });
        if (audio.size) enviar({ audio });
      };
      grabadora.current = rec;
      rec.start();
      setGrabando(true);
    } catch (err) {
      setError(i18n.t("aiAgents.test.micDenied"));
    }
  };

  return (
    <div className={classes.raiz}>
      <div className={classes.barra}>
        <Typography variant="caption" color="textSecondary" style={{ flex: "1 1 220px" }}>
          {i18n.t("aiAgents.test.help")}
        </Typography>
        <Button size="small" variant="outlined" onClick={comprobar} disabled={comprobando}>
          {comprobando ? <CircularProgress size={14} /> : i18n.t("aiAgents.test.checkModel")}
        </Button>
        <Tooltip title={i18n.t("aiAgents.test.reset")}>
          <IconButton size="small" onClick={reiniciar}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>

      {capacidades && (
        <div className={classes.barra}>
          <Capacidad etiqueta={i18n.t("aiAgents.test.images")} valor={capacidades.imagen} />
          <Capacidad etiqueta={i18n.t("aiAgents.test.audio")} valor={capacidades.audio} />
          <Capacidad etiqueta={i18n.t("aiAgents.test.tools")} valor={capacidades.herramientas} />
          {(capacidades.avisos || []).map((a) => (
            <Typography key={a} variant="caption" color="error">
              {i18n.exists(`aiAgents.test.notices.${a}`) ? i18n.t(`aiAgents.test.notices.${a}`) : a}
            </Typography>
          ))}
        </div>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} style={{ marginBottom: 8 }}>
          {error}
        </Alert>
      )}

      <div className={classes.hilo}>
        {mensajes.length === 0 && (
          <Typography variant="body2" className={classes.vacio}>
            {i18n.t("aiAgents.test.empty")}
          </Typography>
        )}
        {mensajes.map((m, i) =>
          m.de === "nota" ? (
            // eslint-disable-next-line react/no-array-index-key
            <Typography key={i} variant="caption" className={classes.nota}>
              {m.texto}
            </Typography>
          ) : (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={`${classes.fila} ${m.de === "cliente" ? classes.delCliente : ""}`}>
              <div className={`${classes.burbuja} ${m.de === "cliente" ? classes.burbujaCliente : classes.burbujaAgente}`}>
                {m.texto}
              </div>
            </div>
          )
        )}
        {enviando && <CircularProgress size={18} />}
        <div ref={finRef} />
      </div>

      <div className={classes.entrada}>
        <input
          type="file"
          hidden
          accept="image/*"
          ref={imagenRef}
          onChange={(e) => {
            const imagen = e.target.files?.[0];
            e.target.value = "";
            if (imagen) enviar({ imagen });
          }}
        />
        <Tooltip title={i18n.t("aiAgents.test.sendImage")}>
          <span>
            <IconButton size="small" onClick={() => imagenRef.current?.click()} disabled={enviando || grabando}>
              <ImageIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={grabando ? i18n.t("aiAgents.test.stopRecording") : i18n.t("aiAgents.test.record")}>
          <span>
            <IconButton size="small" onClick={alternarGrabacion} disabled={enviando} color={grabando ? "secondary" : "default"}>
              {grabando ? <Stop /> : <Mic />}
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder={i18n.t("aiAgents.test.placeholder")}
          variant="outlined"
          size="small"
          fullWidth
          multiline
          maxRows={4}
          disabled={enviando || grabando}
        />
        <IconButton color="primary" onClick={() => enviar()} disabled={enviando || grabando || !texto.trim()}>
          <Send />
        </IconButton>
      </div>
    </div>
  );
};

export default AiAgentTestChat;
