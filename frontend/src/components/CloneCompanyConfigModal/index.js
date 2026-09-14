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
} from "./comun";

/**
 * Clonar la configuracion de una empresa en otra.
 *
 * Solo para superadministrador: las pantallas que lo abren ya lo exigen y
 * el backend lo vuelve a comprobar. Antes de confirmar se ensena la lista de
 * lo que se copia y lo que no, y al terminar el resumen que devuelve el
 * servidor, con lo copiado, lo que ya existia y lo que se omitio por regla.
 */

const CloneCompanyConfigModal = ({ open, onClose }) => {
  const classes = useEstilosClonado();

  const [empresas, setEmpresas] = useState([]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [clonando, setClonando] = useState(false);
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    if (!open) return;
    setOrigen("");
    setDestino("");
    setResumen(null);

    api
      .get("/companies/list")
      .then(({ data }) => setEmpresas(Array.isArray(data) ? data : []))
      .catch(toastError);
  }, [open]);

  const puedeClonar =
    origen !== "" && destino !== "" && origen !== destino && !clonando && !resumen;

  const clonar = async () => {
    setClonando(true);
    try {
      const { data } = await api.post("/companies/clone-config", {
        sourceCompanyId: origen,
        targetCompanyId: destino,
      });
      setResumen(data);
      toast.success(i18n.t("cloneCompany.done"));
    } catch (err) {
      toastError(err);
    }
    setClonando(false);
  };

  const selector = (etiqueta, valor, alCambiar, excluir) => (
    <TextField
      select
      className={classes.campo}
      variant="outlined"
      size="small"
      label={etiqueta}
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      disabled={clonando || Boolean(resumen)}
    >
      {empresas.map((c) => (
        <MenuItem key={c.id} value={c.id} disabled={c.id === excluir}>
          {c.id} · {c.name}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>{i18n.t("cloneCompany.title")}</DialogTitle>

      <DialogContent dividers>
        <div className={classes.ayuda}>{i18n.t("cloneCompany.help")}</div>

        <div className={classes.fila}>
          {selector(i18n.t("cloneCompany.source"), origen, setOrigen, destino)}
          {selector(i18n.t("cloneCompany.target"), destino, setDestino, origen)}
        </div>

        {!resumen && (
          <>
            <div className={classes.columnas}>
              <BloqueLista
                titulo={i18n.t("cloneCompany.copies")}
                items={listaTraducida("cloneCompany.copiesList")}
              />
              <BloqueLista
                titulo={i18n.t("cloneCompany.notCopies")}
                items={listaTraducida("cloneCompany.notCopiesList")}
              />
            </div>

            <BloqueLista
              className={classes.separado}
              titulo={i18n.t("cloneCompany.notesTitle")}
              items={listaTraducida("cloneCompany.notes")}
            />
          </>
        )}

        <ResumenClonado resumen={resumen} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={clonando}>
          {resumen ? i18n.t("cloneCompany.close") : i18n.t("cloneCompany.cancel")}
        </Button>
        {!resumen && (
          <Button
            color="primary"
            variant="contained"
            onClick={clonar}
            disabled={!puedeClonar}
          >
            {clonando ? (
              <>
                <CircularProgress size={16} style={{ marginRight: 8 }} />
                {i18n.t("cloneCompany.cloning")}
              </>
            ) : (
              i18n.t("cloneCompany.confirm")
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CloneCompanyConfigModal;
