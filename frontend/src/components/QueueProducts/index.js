import React, { useCallback, useEffect, useState } from "react";

import {
  Button,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddIcon from "@material-ui/icons/Add";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";

/**
 * Catalogo de productos y servicios de una cola.
 *
 * Vive dentro del modal de Colas, como una pestaña mas. Lo que se da de
 * alta aqui es lo que despues aparece en el formulario de venta cuando el
 * ticket pertenece a esta cola.
 */

const useStyles = makeStyles(theme => ({
  raiz: {
    padding: theme.spacing(2),
  },
  explicacion: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  formulario: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    marginBottom: theme.spacing(2),
  },
  campoNombre: {
    flex: "1 1 200px",
    minWidth: 160,
  },
  campoPrecio: {
    flex: "0 0 120px",
  },
  tabla: {
    border: `1px solid ${theme.palette.tokens.border.border}`,
    borderRadius: theme.palette.tokens.radius.md,
    overflowX: "auto",
  },
  // Un producto apagado sigue en la lista para poder reactivarlo, pero se
  // atenua para que no se confunda con los que si se ofrecen.
  filaInactiva: {
    opacity: 0.55,
  },
  vacio: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

const QueueProducts = ({ queueId }) => {
  const classes = useStyles();

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [paraBorrar, setParaBorrar] = useState(null);

  const cargar = useCallback(async () => {
    if (!queueId) return;
    setCargando(true);
    try {
      const { data } = await api.get(`/queues/${queueId}/products`);
      setProductos(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCargando(false);
    }
  }, [queueId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const anadir = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await api.post(`/queues/${queueId}/products`, {
        name: nombre,
        // Vacio significa "sin precio fijado", no cero: hay servicios que
        // se pactan en cada venta.
        price: precio === "" ? null : precio,
        order: productos.length,
      });
      setNombre("");
      setPrecio("");
      await cargar();
      toast.success(i18n.t("queueProducts.toasts.added"));
    } catch (err) {
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarActivo = async producto => {
    try {
      await api.put(`/queue-products/${producto.id}`, {
        active: !producto.active,
      });
      await cargar();
    } catch (err) {
      toastError(err);
    }
  };

  const borrar = async () => {
    if (!paraBorrar) return;
    try {
      await api.delete(`/queue-products/${paraBorrar.id}`);
      await cargar();
      toast.success(i18n.t("queueProducts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    } finally {
      setParaBorrar(null);
    }
  };

  // El catalogo cuelga de la cola, asi que no hay donde guardarlo mientras
  // la cola no exista.
  if (!queueId) {
    return (
      <div className={classes.raiz}>
        <Typography variant="body2" className={classes.explicacion}>
          {i18n.t("queueProducts.saveQueueFirst")}
        </Typography>
      </div>
    );
  }

  return (
    <div className={classes.raiz}>
      <Typography variant="body2" className={classes.explicacion}>
        {i18n.t("queueProducts.help")}
      </Typography>

      <div className={classes.formulario}>
        <TextField
          className={classes.campoNombre}
          label={i18n.t("queueProducts.form.name")}
          variant="outlined"
          size="small"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              anadir();
            }
          }}
        />
        <TextField
          className={classes.campoPrecio}
          label={i18n.t("queueProducts.form.price")}
          variant="outlined"
          size="small"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          value={precio}
          onChange={e => setPrecio(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              anadir();
            }
          }}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          disabled={guardando || !nombre.trim()}
          onClick={anadir}
        >
          {i18n.t("queueProducts.buttons.add")}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.tabla} elevation={0}>
        {productos.length === 0 ? (
          <Typography variant="body2" className={classes.vacio}>
            {cargando
              ? i18n.t("queueProducts.loading")
              : i18n.t("queueProducts.empty")}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("queueProducts.table.name")}</TableCell>
                <TableCell align="right">
                  {i18n.t("queueProducts.table.price")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("queueProducts.table.active")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("queueProducts.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productos.map(p => (
                <TableRow
                  key={p.id}
                  className={p.active ? undefined : classes.filaInactiva}
                >
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="right">
                    {p.price === null || p.price === undefined
                      ? "—"
                      : Number(p.price).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      color="primary"
                      checked={!!p.active}
                      onChange={() => cambiarActivo(p)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={i18n.t("queueProducts.buttons.delete")}>
                      <IconButton size="small" onClick={() => setParaBorrar(p)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <ConfirmationModal
        title={i18n.t("queueProducts.confirmDelete.title")}
        open={!!paraBorrar}
        onClose={() => setParaBorrar(null)}
        onConfirm={borrar}
      >
        {i18n.t("queueProducts.confirmDelete.message")}
      </ConfirmationModal>
    </div>
  );
};

export default QueueProducts;
