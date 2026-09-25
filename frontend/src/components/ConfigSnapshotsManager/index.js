import React, { useCallback, useContext, useEffect, useState } from "react";

import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { DeleteOutline } from "@material-ui/icons";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import ConfirmationModal from "../ConfirmationModal";
import CrearInstantaneaModal from "./CrearInstantaneaModal";
import CargarInstantaneaModal from "./CargarInstantaneaModal";
import { nombreModulo } from "./SelectorModulos";

/**
 * Pestana Instantaneas de Configuracion.
 *
 * El superadministrador crea, carga en cualquier empresa y borra; el admin
 * de una empresa ve la lista y carga en la suya. El backend aplica los
 * mismos permisos. Ver docs/INSTANTANEAS.md.
 */

const SIN_ESCAPAR = { interpolation: { escapeValue: false } };

const useStyles = makeStyles((theme) => ({
  raiz: {
    width: "100%",
  },
  cabecera: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.palette.tokens.space.md,
    flexWrap: "wrap",
    marginBottom: theme.palette.tokens.space.md,
  },
  ayuda: {
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    maxWidth: 720,
    color: theme.palette.tokens.text.secondary,
  },
  tabla: {
    overflowX: "auto",
  },
  nombre: {
    fontWeight: 600,
    color: theme.palette.tokens.text.primary,
  },
  descripcion: {
    fontSize: "0.75rem",
    color: theme.palette.tokens.text.secondary,
  },
  acciones: {
    whiteSpace: "nowrap",
  },
  vacio: {
    padding: theme.palette.tokens.space.xl,
    textAlign: "center",
    color: theme.palette.tokens.text.secondary,
  },
}));

const ConfigSnapshotsManager = ({ company }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const esSuper = user?.super === true;

  const [instantaneas, setInstantaneas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [aCargar, setACargar] = useState(null);
  const [aBorrar, setABorrar] = useState(null);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/config-snapshots");
      setInstantaneas(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  const borrar = async (instantanea) => {
    if (!instantanea) return;
    try {
      await api.delete(`/config-snapshots/${instantanea.id}`);
      toast.success(i18n.t("snapshots.deleted"));
      cargarLista();
    } catch (err) {
      toastError(err);
    }
  };

  const empresaPropia = {
    id: company?.id ?? user?.companyId,
    name: company?.name || "",
  };

  return (
    <div className={classes.raiz}>
      <div className={classes.cabecera}>
        <div className={classes.ayuda}>
          {esSuper ? i18n.t("snapshots.help") : i18n.t("snapshots.helpAdmin")}
        </div>
        {esSuper && (
          <Button variant="contained" color="primary" onClick={() => setCrearAbierto(true)}>
            {i18n.t("snapshots.createButton")}
          </Button>
        )}
      </div>

      <Paper variant="outlined" className={classes.tabla}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("snapshots.table.name")}</TableCell>
              <TableCell>{i18n.t("snapshots.table.source")}</TableCell>
              <TableCell>{i18n.t("snapshots.table.modules")}</TableCell>
              <TableCell>{i18n.t("snapshots.table.createdAt")}</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {instantaneas.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className={classes.nombre}>{s.name}</div>
                  {s.description && <div className={classes.descripcion}>{s.description}</div>}
                </TableCell>
                <TableCell>{s.sourceCompanyName || "—"}</TableCell>
                <TableCell>
                  <Tooltip title={(s.modules || []).map(nombreModulo).join(", ")}>
                    <span>
                      {i18n.t("snapshots.modulesCount", { count: (s.modules || []).length })}
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell>{datetimeToClient(s.createdAt)}</TableCell>
                <TableCell align="right" className={classes.acciones}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => setACargar(s)}
                  >
                    {i18n.t("snapshots.loadButton")}
                  </Button>
                  {esSuper && (
                    <Tooltip title={i18n.t("snapshots.deleteButton")}>
                      <IconButton
                        size="small"
                        onClick={() => setABorrar(s)}
                        aria-label={i18n.t("snapshots.deleteButton")}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!cargando && !instantaneas.length && (
          <div className={classes.vacio}>{i18n.t("snapshots.empty")}</div>
        )}
      </Paper>

      {esSuper && (
        <CrearInstantaneaModal
          open={crearAbierto}
          onClose={() => setCrearAbierto(false)}
          onCreated={() => cargarLista()}
        />
      )}

      <CargarInstantaneaModal
        open={Boolean(aCargar)}
        snapshot={aCargar}
        esSuper={esSuper}
        empresaPropia={empresaPropia}
        onClose={() => setACargar(null)}
      />

      <ConfirmationModal
        title={i18n.t("snapshots.deleteTitle", { name: aBorrar?.name || "", ...SIN_ESCAPAR })}
        open={Boolean(aBorrar)}
        onClose={() => setABorrar(null)}
        onConfirm={() => borrar(aBorrar)}
      >
        {i18n.t("snapshots.deleteMessage")}
      </ConfirmationModal>
    </div>
  );
};

export default ConfigSnapshotsManager;
