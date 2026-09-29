import React, { useCallback, useContext, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";

import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Facturacion de la empresa: en que plan esta y que facturas tiene.
 *
 * No inventa nada. El resumen sale del propio Company/Plan que ya se
 * consulta hoy, y las facturas son las mismas que lista la pantalla
 * /financeiro. No hay monedero ni tarjeta guardada: no hay pasarela de pago
 * conectada, y una pantalla que finja tenerla enganaria al que la mire.
 */

const useStyles = makeStyles(theme => ({
  contenedor: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    padding: theme.spacing(1)
  },
  tarjetas: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  tarjeta: {
    padding: theme.spacing(2),
    minWidth: 180,
    flex: "1 1 180px"
  },
  etiqueta: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 11
  },
  vencida: {
    color: theme.palette.error.main,
    fontWeight: 600
  }
}));

const enDinero = valor => Number(valor || 0).toFixed(2);

const comoFecha = valor => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "—" : fecha.toLocaleDateString();
};

const FacturacionResumen = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [empresa, setEmpresa] = useState(null);
  const [facturas, setFacturas] = useState([]);

  const cargar = useCallback(async () => {
    if (!user?.companyId) return;
    try {
      const [e, f] = await Promise.all([
        api.get(`/companies/${user.companyId}`),
        api.get("/invoices/all", { params: { searchParam: "", pageNumber: 1 } })
      ]);
      setEmpresa(e.data);
      setFacturas(Array.isArray(f.data) ? f.data : f.data?.invoices || []);
    } catch (err) {
      // Sin datos no se pinta nada, pero la pestana no puede tumbar la
      // pantalla de Configuracion entera.
      setEmpresa(null);
    }
  }, [user?.companyId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className={classes.contenedor}>
      <div>
        <Typography variant="subtitle1" gutterBottom>
          {i18n.t("settings.billing.summary")}
        </Typography>

        <div className={classes.tarjetas}>
          <Paper className={classes.tarjeta} variant="outlined">
            <Typography className={classes.etiqueta} color="textSecondary">
              {i18n.t("settings.billing.plan")}
            </Typography>
            <Typography variant="h6">{empresa?.plan?.name || "—"}</Typography>
          </Paper>

          <Paper className={classes.tarjeta} variant="outlined">
            <Typography className={classes.etiqueta} color="textSecondary">
              {i18n.t("settings.billing.status")}
            </Typography>
            <Typography variant="h6">
              {empresa
                ? empresa.status
                  ? i18n.t("settings.billing.active")
                  : i18n.t("settings.billing.inactive")
                : "—"}
            </Typography>
          </Paper>

          <Paper className={classes.tarjeta} variant="outlined">
            <Typography className={classes.etiqueta} color="textSecondary">
              {i18n.t("settings.billing.dueDate")}
            </Typography>
            <Typography variant="h6">{comoFecha(empresa?.dueDate)}</Typography>
          </Paper>
        </div>
      </div>

      <div>
        <Typography variant="subtitle1" gutterBottom>
          {i18n.t("settings.billing.invoices")}
        </Typography>

        {facturas.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("settings.billing.noInvoices")}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("settings.billing.detail")}</TableCell>
                <TableCell>{i18n.t("settings.billing.dueDate")}</TableCell>
                <TableCell align="right">{i18n.t("settings.billing.amount")}</TableCell>
                <TableCell>{i18n.t("settings.billing.state")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {facturas.map(factura => (
                <TableRow key={factura.id}>
                  <TableCell>{factura.detail}</TableCell>
                  <TableCell>{comoFecha(factura.dueDate)}</TableCell>
                  <TableCell align="right">${enDinero(factura.value)}</TableCell>
                  <TableCell
                    className={factura.status === "open" ? classes.vencida : ""}
                  >
                    {factura.status === "open"
                      ? i18n.t("settings.billing.open")
                      : i18n.t("settings.billing.paid")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default FacturacionResumen;
