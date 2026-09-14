import React, { useEffect, useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  useEstilosClonado,
  listaTraducida,
  BloqueLista,
} from "../CloneCompanyConfigModal/comun";
import SelectorModulos, { MODULOS } from "./SelectorModulos";

/**
 * Crear una instantanea de configuracion. Solo superadministrador: la
 * pestana lo muestra solo a el y el backend lo vuelve a comprobar.
 */

const SIN_ESCAPAR = { interpolation: { escapeValue: false } };

const CrearInstantaneaModal = ({ open, onClose, onCreated }) => {
  const classes = useEstilosClonado();

  const [empresas, setEmpresas] = useState([]);
  const [origen, setOrigen] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [modulos, setModulos] = useState(MODULOS);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState(null);

  useEffect(() => {
    if (!open) return;
    setOrigen("");
    setNombre("");
    setDescripcion("");
    setModulos(MODULOS);
    setCreada(null);

    api
      .get("/companies/list")
      .then(({ data }) => setEmpresas(Array.isArray(data) ? data : []))
      .catch(toastError);
  }, [open]);

  const bloqueado = enviando || Boolean(creada);
  const valido = origen !== "" && nombre.trim().length >= 2 && modulos.length > 0;

  const crear = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post("/config-snapshots", {
        sourceCompanyId: origen,
        name: nombre.trim(),
        description: descripcion.trim(),
        modules: modulos,
      });
      setCreada(data);
      toast.success(i18n.t("snapshots.createModal.done", { name: data.name, ...SIN_ESCAPAR }));
      if (onCreated) onCreated(data);
    } catch (err) {
      toastError(err);
    }
    setEnviando(false);
  };

  const contenido = creada
    ? Object.keys(creada.counts || {}).map(
        (clave) =>
          `${i18n.t(`cloneCompany.keys.${clave}`, { defaultValue: clave })}: ${creada.counts[clave]}`
      )
    : [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{i18n.t("snapshots.createModal.title")}</DialogTitle>

      <DialogContent dividers>
        <div className={classes.ayuda}>{i18n.t("snapshots.createModal.help")}</div>

        <div className={classes.fila}>
          <TextField
            select
            className={classes.campo}
            variant="outlined"
            size="small"
            label={i18n.t("snapshots.createModal.source")}
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            disabled={bloqueado}
          >
            {empresas.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.id} · {c.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            required
            label={i18n.t("snapshots.createModal.name")}
            placeholder={i18n.t("snapshots.createModal.namePlaceholder")}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={bloqueado}
          />
        </div>

        <div className={classes.fila}>
          <TextField
            className={classes.campo}
            variant="outlined"
            size="small"
            multiline
            rows={2}
            label={i18n.t("snapshots.createModal.description")}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={bloqueado}
          />
        </div>

        {!creada && (
          <>
            <div className={classes.titulo}>{i18n.t("snapshots.createModal.modulesTitle")}</div>
            <SelectorModulos
              seleccion={modulos}
              onChange={setModulos}
              disabled={bloqueado}
            />
            <BloqueLista
              className={classes.separado}
              titulo={i18n.t("snapshots.notesTitle")}
              items={listaTraducida("snapshots.createModal.notes")}
            />
          </>
        )}

        {creada && (
          <div className={classes.columnas}>
            <BloqueLista
              titulo={i18n.t("snapshots.createModal.captured")}
              items={contenido.length ? contenido : [i18n.t("snapshots.createModal.empty")]}
            />
            <BloqueLista
              titulo={i18n.t("snapshots.createModal.missingFiles")}
              items={creada.missingFiles || []}
            />
          </div>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={enviando}>
          {creada
            ? i18n.t("snapshots.createModal.close")
            : i18n.t("snapshots.createModal.cancel")}
        </Button>
        {!creada && (
          <Button
            color="primary"
            variant="contained"
            onClick={crear}
            disabled={!valido || enviando}
          >
            {enviando ? (
              <>
                <CircularProgress size={16} style={{ marginRight: 8 }} />
                {i18n.t("snapshots.createModal.creating")}
              </>
            ) : (
              i18n.t("snapshots.createModal.confirm")
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CrearInstantaneaModal;
