import React, { useCallback, useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Paper from "@material-ui/core/Paper";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

/**
 * Recarga de credito para los Agentes IA.
 *
 * La pasarela de pago todavia no esta decidida, asi que al confirmar solo se
 * registra la intencion y se le dice al cliente que contacte con soporte. La
 * pantalla esta entera: el dia que se conecte una pasarela, lo unico que
 * cambia es ComprarCreditoService en el backend.
 *
 * La recarga es 1 a 1: lo que paga es lo que le entra de saldo. El margen de
 * la agencia ya va en el precio por token, no se cobra aqui otra vez.
 */

const MONTOS = [2000, 5000, 10000];

const useStyles = makeStyles(theme => ({
  contenedor: {
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    maxWidth: 720
  },
  montos: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  monto: {
    minWidth: 120,
    cursor: "pointer",
    border: `2px solid transparent`,
    transition: "border-color .15s"
  },
  elegido: {
    borderColor: theme.palette.primary.main
  },
  aviso: {
    padding: theme.spacing(2),
    borderRadius: 8,
    background:
      theme.palette.type === "dark"
        ? `${theme.palette.warning.dark}33`
        : `${theme.palette.warning.light}26`
  }
}));

const enDolares = centavos => (centavos / 100).toFixed(2);

const ComprarCreditoIa = () => {
  const classes = useStyles();

  const [saldo, setSaldo] = useState(null);
  const [elegido, setElegido] = useState(MONTOS[1]);
  const [libre, setLibre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const consultar = useCallback(async () => {
    try {
      const { data } = await api.get("/ai-credits/balance");
      setSaldo(data);
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const minimo = saldo?.minPurchaseCents ?? 1000;

  // El campo libre manda sobre los botones cuando tiene algo escrito.
  const montoCentavos = libre.trim()
    ? Math.round(Number(libre.replace(",", ".")) * 100)
    : elegido;

  const valido = Number.isInteger(montoCentavos) && montoCentavos >= minimo;

  const confirmar = async () => {
    setEnviando(true);
    setResultado(null);
    try {
      const { data } = await api.post("/ai-credits/purchase-intent", {
        amountCents: montoCentavos
      });
      setResultado(data);
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("aiCredit.buyTitle")}</Title>
      </MainHeader>

      <Paper className={classes.contenedor} variant="outlined">
        {saldo && (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("aiCredit.currentBalance")}: <strong>${enDolares(saldo.balanceCents)}</strong>
          </Typography>
        )}

        <div>
          <Typography variant="subtitle2" gutterBottom>
            {i18n.t("aiCredit.chooseAmount")}
          </Typography>

          <div className={classes.montos}>
            {MONTOS.map(monto => (
              <Card
                key={monto}
                variant="outlined"
                className={`${classes.monto} ${
                  !libre.trim() && elegido === monto ? classes.elegido : ""
                }`}
                onClick={() => {
                  setElegido(monto);
                  setLibre("");
                }}
              >
                <CardContent>
                  <Typography variant="h6">${enDolares(monto)}</Typography>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <TextField
          label={i18n.t("aiCredit.otherAmount")}
          value={libre}
          onChange={e => setLibre(e.target.value)}
          type="number"
          variant="outlined"
          size="small"
          helperText={`${i18n.t("aiCredit.minimum")}: $${enDolares(minimo)}`}
          error={!!libre.trim() && !valido}
        />

        <Button
          variant="contained"
          color="primary"
          disabled={!valido || enviando}
          onClick={confirmar}
        >
          {i18n.t("aiCredit.confirm")} — ${enDolares(montoCentavos || 0)}
        </Button>

        {resultado && (
          <div className={classes.aviso}>
            <Typography variant="body2">
              {i18n.t("aiCredit.notAvailableYet")}
            </Typography>
          </div>
        )}
      </Paper>
    </MainContainer>
  );
};

export default ComprarCreditoIa;
