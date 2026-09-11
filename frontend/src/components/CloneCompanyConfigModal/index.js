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
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

/**
 * Clonar la configuracion de una empresa en otra.
 *
 * Solo para superadministrador: la pantalla de empresas ya lo exige y el
 * backend lo vuelve a comprobar. Antes de confirmar se ensena la lista de
 * lo que se copia y lo que no, y al terminar el resumen que devuelve el
 * servidor, con lo copiado, lo que ya existia y lo que se omitio por regla.
 */

const useStyles = makeStyles((theme) => ({
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
    flex: "1 1 220px",
  },
  columnas: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: theme.palette.tokens.space.md,
  },
  bloque: {
    padding: theme.palette.tokens.space.md,
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
  },
  titulo: {
    fontWeight: 700,
    fontSize: "0.8125rem",
    marginBottom: 6,
    color: theme.palette.tokens.text.primary,
  },
  lista: {
    margin: 0,
    paddingLeft: 18,
    fontSize: "0.8125rem",
    lineHeight: 1.55,
    color: theme.palette.tokens.text.secondary,
  },
  notas: {
    marginTop: theme.palette.tokens.space.md,
  },
}));

/** Lista traducida; [] si la clave no es una lista. */
const lista = (clave) => {
  const valor = i18n.t(clave, { returnObjects: true });
  return Array.isArray(valor) ? valor : [];
};

/** Nombre legible de cada contador del resumen. */
const etiquetaDe = (clave) =>
  i18n.t(`cloneCompany.keys.${clave}`, { defaultValue: clave });

const Contadores = ({ titulo, datos, classes }) => {
  const entradas = Object.entries(datos || {}).filter(([, n]) => n > 0);
  if (!entradas.length) return null;
  return (
    <div className={classes.bloque}>
      <div className={classes.titulo}>{titulo}</div>
      <ul className={classes.lista}>
        {entradas.map(([clave, n]) => (
          <li key={clave}>
            {etiquetaDe(clave)}: {n}
          </li>
        ))}
      </ul>
    </div>
  );
};

const CloneCompanyConfigModal = ({ open, onClose }) => {
  const classes = useStyles();

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
              <div className={classes.bloque}>
                <div className={classes.titulo}>{i18n.t("cloneCompany.copies")}</div>
                <ul className={classes.lista}>
                  {lista("cloneCompany.copiesList").map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className={classes.bloque}>
                <div className={classes.titulo}>{i18n.t("cloneCompany.notCopies")}</div>
                <ul className={classes.lista}>
                  {lista("cloneCompany.notCopiesList").map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={`${classes.bloque} ${classes.notas}`}>
              <div className={classes.titulo}>{i18n.t("cloneCompany.notesTitle")}</div>
              <ul className={classes.lista}>
                {lista("cloneCompany.notes").map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {resumen && (
          <div className={classes.columnas}>
            <Contadores
              titulo={i18n.t("cloneCompany.result.copied")}
              datos={resumen.copiados}
              classes={classes}
            />
            <Contadores
              titulo={i18n.t("cloneCompany.result.existing")}
              datos={resumen.yaExistian}
              classes={classes}
            />
            <Contadores
              titulo={i18n.t("cloneCompany.result.skipped")}
              datos={resumen.omitidos}
              classes={classes}
            />
            <div className={classes.bloque}>
              <div className={classes.titulo}>{i18n.t("cloneCompany.result.files")}</div>
              <ul className={classes.lista}>
                <li>{resumen.archivos?.copiados || 0}</li>
                {(resumen.archivos?.ausentes || []).length > 0 && (
                  <li>
                    {i18n.t("cloneCompany.result.missingFiles")}:{" "}
                    {resumen.archivos.ausentes.join(", ")}
                  </li>
                )}
              </ul>
            </div>
            {(resumen.avisos || []).length > 0 && (
              <div className={classes.bloque}>
                <div className={classes.titulo}>{i18n.t("cloneCompany.result.warnings")}</div>
                <ul className={classes.lista}>
                  {resumen.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
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
