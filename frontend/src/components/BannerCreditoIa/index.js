import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import SmartToyIcon from "@material-ui/icons/Memory";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Aviso de que se acabo el saldo de los Agentes IA.
 *
 * Solo aparece cuando la empresa depende de la clave compartida de la
 * agencia. Si todos sus agentes traen su propia clave de OpenAI, su gasto
 * no pasa por este saldo y no hay nada que avisarle.
 *
 * Mismo sitio y mismo aire que BannerPrueba, que hace lo propio con el fin
 * de la prueba gratuita.
 */

const useStyles = makeStyles(theme => ({
  banner: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    margin: theme.spacing(0, 0, 1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.error.main}55`,
    background:
      theme.palette.type === "dark"
        ? `linear-gradient(90deg, ${theme.palette.error.dark}33, transparent)`
        : `linear-gradient(90deg, ${theme.palette.error.light}26, transparent)`,
    maxWidth: "100%",
    boxSizing: "border-box"
  },
  icono: {
    color: theme.palette.error.main,
    flexShrink: 0
  },
  texto: {
    flex: 1,
    minWidth: 200
  },
  acciones: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  }
}));

const BannerCreditoIa = () => {
  const classes = useStyles();
  const history = useHistory();
  const [estado, setEstado] = useState(null);

  const consultar = useCallback(async () => {
    try {
      const { data } = await api.get("/ai-credits/balance");
      setEstado(data);
    } catch (err) {
      // Un fallo aqui no puede romper la plataforma entera: si no se sabe el
      // saldo, no se avisa de nada y ya esta.
      setEstado(null);
    }
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  if (!estado) return null;
  if (!estado.dependeDeClaveCompartida) return null;
  if (estado.balanceCents > 0) return null;

  return (
    <div className={classes.banner}>
      <SmartToyIcon className={classes.icono} />

      <div className={classes.texto}>
        <Typography variant="body2">
          <strong>{i18n.t("aiCredit.bannerTitle")}</strong>
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {i18n.t("aiCredit.bannerHelp")}
        </Typography>
      </div>

      <div className={classes.acciones}>
        {/* No es una pantalla nueva: lleva a la configuracion del agente,
            donde el campo de la clave propia ya existe. */}
        <Button
          size="small"
          variant="outlined"
          onClick={() => history.push("/ai-agents")}
        >
          {i18n.t("aiCredit.useOwnKey")}
        </Button>

        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={() => history.push("/ai-credits/buy")}
        >
          {i18n.t("aiCredit.buyCredit")}
        </Button>
      </div>
    </div>
  );
};

export default BannerCreditoIa;
