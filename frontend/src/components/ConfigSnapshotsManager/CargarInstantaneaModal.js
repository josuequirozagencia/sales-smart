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
  ResumenClonado,
} from "../CloneCompanyConfigModal/comun";
import SelectorModulos, { nombreModulo, ordenar } from "./SelectorModulos";

/**
 * Cargar una instantanea en una empresa.
 *
 * El superadministrador elige la empresa; el admin carga en la suya (el
 * backend no le deja otra). Lo ya cargado de esta instantanea en esa empresa
 * sale marcado y bloqueado: se puede cargar por partes.
 */

const SIN_ESCAPAR = { interpolation: { escapeValue: false } };

const CargarInstantaneaModal = ({
  open,
  onClose,
  snapshot,
  esSuper,
  empresaPropia,
  onApplied,
}) => {
  const classes = useEstilosClonado();

  // Se guarda aparte: al cerrar, el padre pasa snapshot a null antes de que
  // termine la animacion de salida del dialogo.
  const [instantanea, setInstantanea] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [destino, setDestino] = useState("");
  const [yaCargados, setYaCargados] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [consultando, setConsultando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const idPropia = empresaPropia?.id;

  useEffect(() => {
    if (!open || !snapshot) return;
    setInstantanea(snapshot);
    setResultado(null);
    setYaCargados([]);
    setModulos([]);

    if (esSuper) {
      setDestino("");
      api
        .get("/companies/list")
        .then(({ data }) => setEmpresas(Array.isArray(data) ? data : []))
        .catch(toastError);
    } else {
      setDestino(idPropia ?? "");
    }
  }, [open, snapshot, esSuper, idPropia]);

  // Que tiene ya cargado de esta instantanea la empresa elegida.
  useEffect(() => {
    if (!open || !instantanea || destino === "") return undefined;
    let vigente = true;
    setConsultando(true);

    api
      .get(`/config-snapshots/${instantanea.id}/applied`, {
        params: esSuper ? { companyId: destino } : {},
      })
      .then(({ data }) => {
        if (!vigente) return;
        const cargados = data.modules || [];
        setYaCargados(cargados);
        setModulos(ordenar((instantanea.modules || []).filter((m) => !cargados.includes(m))));
      })
      .catch(toastError)
      .finally(() => {
        if (vigente) setConsultando(false);
      });

    return () => {
      vigente = false;
    };
  }, [open, instantanea, destino, esSuper]);

  if (!instantanea) return null;

  const pendientes = (instantanea.modules || []).filter((m) => !yaCargados.includes(m));
  const valido = destino !== "" && modulos.length > 0 && !consultando;

  const cargar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post(`/config-snapshots/${instantanea.id}/apply`, {
        ...(esSuper ? { companyId: destino } : {}),
        modules: modulos,
      });
      setResultado(data);
      toast.success(
        i18n.t("snapshots.loadModal.done", { name: instantanea.name, ...SIN_ESCAPAR })
      );
      if (onApplied) onApplied(data);
    } catch (err) {
      toastError(err);
    }
    setEnviando(false);
  };

  const lista = (mods) => mods.map(nombreModulo).join(", ");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        {i18n.t("snapshots.loadModal.title", { name: instantanea.name, ...SIN_ESCAPAR })}
      </DialogTitle>

      <DialogContent dividers>
        <div className={classes.ayuda}>
          {esSuper
            ? i18n.t("snapshots.loadModal.helpSuper")
            : i18n.t("snapshots.loadModal.helpAdmin")}
        </div>

        {esSuper ? (
          <div className={classes.fila}>
            <TextField
              select
              className={classes.campo}
              variant="outlined"
              size="small"
              label={i18n.t("snapshots.loadModal.target")}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              disabled={enviando || Boolean(resultado)}
            >
              {empresas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.id} · {c.name}
                </MenuItem>
              ))}
            </TextField>
          </div>
        ) : (
          <div className={classes.ayuda}>
            {i18n.t("snapshots.loadModal.ownCompany", {
              name: empresaPropia?.name || "",
              ...SIN_ESCAPAR,
            })}
          </div>
        )}

        {!resultado && destino !== "" && !consultando && (
          <>
            {pendientes.length ? (
              <>
                <div className={classes.titulo}>
                  {i18n.t("snapshots.loadModal.modulesTitle")}
                </div>
                <SelectorModulos
                  disponibles={instantanea.modules || []}
                  seleccion={modulos}
                  onChange={setModulos}
                  yaCargados={yaCargados}
                  disabled={enviando}
                />
              </>
            ) : (
              <BloqueLista
                titulo={i18n.t("snapshots.loadModal.modulesTitle")}
                items={[i18n.t("snapshots.loadModal.allLoaded")]}
              />
            )}
            <BloqueLista
              className={classes.separado}
              titulo={i18n.t("snapshots.notesTitle")}
              items={listaTraducida("snapshots.loadModal.notes")}
            />
          </>
        )}

        {consultando && <CircularProgress size={20} />}

        {resultado && (
          <>
            <BloqueLista
              titulo={i18n.t("snapshots.loadModal.resultTitle")}
              items={[
                i18n.t("snapshots.loadModal.loaded", {
                  list: lista(resultado.cargados || []),
                  ...SIN_ESCAPAR,
                }),
                ...((resultado.yaEstaban || []).length
                  ? [
                      i18n.t("snapshots.loadModal.skipped", {
                        list: lista(resultado.yaEstaban),
                        ...SIN_ESCAPAR,
                      }),
                    ]
                  : []),
              ]}
            />
            <div className={classes.separado}>
              <ResumenClonado resumen={resultado.resumen} />
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={enviando}>
          {resultado
            ? i18n.t("snapshots.loadModal.close")
            : i18n.t("snapshots.loadModal.cancel")}
        </Button>
        {!resultado && (
          <Button
            color="primary"
            variant="contained"
            onClick={cargar}
            disabled={!valido || enviando}
          >
            {enviando ? (
              <>
                <CircularProgress size={16} style={{ marginRight: 8 }} />
                {i18n.t("snapshots.loadModal.loading")}
              </>
            ) : (
              i18n.t("snapshots.loadModal.confirm")
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CargarInstantaneaModal;
