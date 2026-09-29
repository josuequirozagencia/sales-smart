import React, { useCallback, useContext, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toast from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

/**
 * Panel de credito IA, solo para superadministracion.
 *
 * Tres cosas: la clave compartida de OpenAI y el margen global, la tabla de
 * precios por modelo, y el saldo de cada empresa con su historial.
 *
 * La clave nunca vuelve del backend: solo se ven los ultimos 4 caracteres.
 * El campo se deja vacio para no tocarla.
 */

const useStyles = makeStyles(theme => ({
  contenedor: {
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3)
  },
  fila: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    alignItems: "flex-end"
  },
  seccion: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2)
  },
  negativo: {
    color: theme.palette.error.main,
    fontWeight: 600
  }
}));

const enDolares = centavos => (Number(centavos || 0) / 100).toFixed(2);

const CreditoIaAdmin = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const esSuper = user?.super === true;

  const [ajustes, setAjustes] = useState(null);
  const [claveNueva, setClaveNueva] = useState("");
  const [precios, setPrecios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [otorgando, setOtorgando] = useState(null);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [historial, setHistorial] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [a, p, e] = await Promise.all([
        api.get("/ai-credits/settings"),
        api.get("/ai-credits/pricing"),
        api.get("/ai-credits/companies")
      ]);
      setAjustes(a.data);
      setPrecios(p.data);
      setEmpresas(e.data);
    } catch (err) {
      toast(err);
    }
  }, []);

  useEffect(() => {
    // Sin ser superadmin no se pide nada: los endpoints devolverian 403 y lo
    // unico que veria el usuario es una pantalla de errores.
    if (esSuper) cargar();
  }, [cargar, esSuper]);

  const guardarAjustes = async () => {
    try {
      const cuerpo = {
        defaultMarginPercent: ajustes.defaultMarginPercent,
        minPurchaseCents: ajustes.minPurchaseCents
      };
      // Vacio significa "no la cambies", no "borrala".
      if (claveNueva.trim()) cuerpo.sharedOpenAiApiKey = claveNueva.trim();

      const { data } = await api.put("/ai-credits/settings", cuerpo);
      setAjustes(data);
      setClaveNueva("");
    } catch (err) {
      toast(err);
    }
  };

  const guardarPrecio = async fila => {
    try {
      await api.put(`/ai-credits/pricing/${fila.id}`, {
        pricePerUnitCents: fila.pricePerUnitCents,
        marginPercentOverride: fila.marginPercentOverride
      });
      await cargar();
    } catch (err) {
      toast(err);
    }
  };

  const otorgar = async () => {
    try {
      const centavos = Math.round(Number(monto.replace(",", ".")) * 100);
      await api.post(`/ai-credits/companies/${otorgando.id}/grant`, {
        amountCents: centavos,
        description: motivo || null
      });
      setOtorgando(null);
      setMonto("");
      setMotivo("");
      await cargar();
    } catch (err) {
      toast(err);
    }
  };

  const verHistorial = async empresa => {
    try {
      const { data } = await api.get(`/ai-credits/companies/${empresa.id}/ledger`);
      setHistorial({ empresa, ...data });
    } catch (err) {
      toast(err);
    }
  };

  // La ruta es privada, no de superadmin: cualquiera con sesion puede pedir
  // esta direccion. El backend rechaza sus llamadas, pero sin esto veria el
  // formulario vacio y una lluvia de errores, que no es forma de decir que
  // no le corresponde.
  if (!esSuper) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>{i18n.t("aiCredit.adminTitle")}</Title>
        </MainHeader>
        <Paper className={classes.seccion} variant="outlined">
          <Typography variant="body2" color="textSecondary">
            {i18n.t("aiCredit.onlySuper")}
          </Typography>
        </Paper>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("aiCredit.adminTitle")}</Title>
      </MainHeader>

      <div className={classes.contenedor}>
        <Paper className={classes.seccion} variant="outlined">
          <Typography variant="subtitle1">{i18n.t("aiCredit.sharedKey")}</Typography>

          {ajustes && (
            <div className={classes.fila}>
              <TextField
                label={i18n.t("aiCredit.sharedKey")}
                value={claveNueva}
                onChange={e => setClaveNueva(e.target.value)}
                placeholder={
                  ajustes.configurada
                    ? `•••• ${ajustes.sharedOpenAiApiKeyLast4}`
                    : i18n.t("aiCredit.noKeyYet")
                }
                variant="outlined"
                size="small"
                style={{ minWidth: 280 }}
                helperText={i18n.t("aiCredit.keyHelp")}
              />

              <TextField
                label={i18n.t("aiCredit.margin")}
                type="number"
                value={ajustes.defaultMarginPercent}
                onChange={e =>
                  setAjustes({ ...ajustes, defaultMarginPercent: e.target.value })
                }
                variant="outlined"
                size="small"
                style={{ width: 140 }}
              />

              <TextField
                label={i18n.t("aiCredit.minPurchase")}
                type="number"
                value={ajustes.minPurchaseCents}
                onChange={e =>
                  setAjustes({ ...ajustes, minPurchaseCents: e.target.value })
                }
                variant="outlined"
                size="small"
                style={{ width: 160 }}
              />

              <Button variant="contained" color="primary" onClick={guardarAjustes}>
                {i18n.t("aiCredit.save")}
              </Button>
            </div>
          )}
        </Paper>

        <Paper className={classes.seccion} variant="outlined">
          <Typography variant="subtitle1">{i18n.t("aiCredit.pricing")}</Typography>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("aiCredit.pricingHelp")}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("aiCredit.model")}</TableCell>
                <TableCell>{i18n.t("aiCredit.unit")}</TableCell>
                <TableCell>{i18n.t("aiCredit.costPerUnit")}</TableCell>
                <TableCell>{i18n.t("aiCredit.marginOverride")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {precios.map((fila, i) => (
                <TableRow key={fila.id}>
                  <TableCell>{fila.model}</TableCell>
                  <TableCell>{fila.unit}</TableCell>
                  <TableCell>
                    <TextField
                      value={fila.pricePerUnitCents}
                      onChange={e => {
                        const copia = [...precios];
                        copia[i] = { ...fila, pricePerUnitCents: e.target.value };
                        setPrecios(copia);
                      }}
                      size="small"
                      style={{ width: 140 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={fila.marginPercentOverride ?? ""}
                      onChange={e => {
                        const copia = [...precios];
                        copia[i] = {
                          ...fila,
                          marginPercentOverride: e.target.value || null
                        };
                        setPrecios(copia);
                      }}
                      size="small"
                      style={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => guardarPrecio(precios[i])}>
                      {i18n.t("aiCredit.save")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper className={classes.seccion} variant="outlined">
          <Typography variant="subtitle1">{i18n.t("aiCredit.companies")}</Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("aiCredit.company")}</TableCell>
                <TableCell>{i18n.t("aiCredit.balance")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {empresas.map(empresa => (
                <TableRow key={empresa.id}>
                  <TableCell>{empresa.name}</TableCell>
                  <TableCell className={empresa.balanceCents <= 0 ? classes.negativo : ""}>
                    ${enDolares(empresa.balanceCents)}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setOtorgando(empresa)}>
                      {i18n.t("aiCredit.grant")}
                    </Button>
                    <Button size="small" onClick={() => verHistorial(empresa)}>
                      {i18n.t("aiCredit.history")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </div>

      <Dialog open={!!otorgando} onClose={() => setOtorgando(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {i18n.t("aiCredit.grantTo")} {otorgando?.name}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={i18n.t("aiCredit.amountUsd")}
            type="number"
            value={monto}
            onChange={e => setMonto(e.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            label={i18n.t("aiCredit.reason")}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOtorgando(null)}>{i18n.t("aiCredit.cancel")}</Button>
          <Button color="primary" variant="contained" onClick={otorgar} disabled={!monto}>
            {i18n.t("aiCredit.grant")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!historial} onClose={() => setHistorial(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {i18n.t("aiCredit.history")} — {historial?.empresa?.name}
        </DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("aiCredit.date")}</TableCell>
                <TableCell>{i18n.t("aiCredit.type")}</TableCell>
                <TableCell>{i18n.t("aiCredit.amount")}</TableCell>
                <TableCell>{i18n.t("aiCredit.balanceAfter")}</TableCell>
                <TableCell>{i18n.t("aiCredit.detail")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(historial?.movimientos || []).map(m => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{m.type}</TableCell>
                  <TableCell>${enDolares(m.amountCents)}</TableCell>
                  <TableCell>${enDolares(m.balanceAfterCents)}</TableCell>
                  <TableCell>{m.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistorial(null)}>{i18n.t("aiCredit.close")}</Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default CreditoIaAdmin;
