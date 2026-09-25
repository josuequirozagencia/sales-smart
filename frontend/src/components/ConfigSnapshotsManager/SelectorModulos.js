import React from "react";
import { Checkbox, FormControlLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

/**
 * Casillas de los modulos de configuracion de una instantanea.
 *
 * Mismo orden y mismas dependencias que el motor del backend
 * (ConfigPackageService/motor.ts): marcar el chatbot o los prompts marca
 * tambien las colas, y quitar las colas quita lo que cuelga de ellas. Un
 * modulo ya cargado cuenta como dependencia cubierta y se muestra marcado y
 * bloqueado.
 */

export const MODULOS = [
  "integraciones",
  "archivos",
  "etiquetas",
  "colas",
  "chatbot",
  "mensajesRapidos",
  "prompts",
  "ajustesEmpresa",
  "cumpleanos",
  "campanas",
  "motivos",
  "webhooks",
];

export const DEPENDENCIAS = { chatbot: ["colas"], prompts: ["colas"] };

export const ordenar = (lista) => MODULOS.filter((m) => lista.includes(m));

export const nombreModulo = (m) => i18n.t(`snapshots.modules.${m}.label`);

const useStyles = makeStyles((theme) => ({
  rejilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    columnGap: theme.palette.tokens.space.md,
  },
  opcion: {
    alignItems: "flex-start",
    margin: 0,
    padding: "4px 0",
  },
  casilla: {
    paddingTop: 2,
  },
  nombre: {
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.3,
    color: theme.palette.tokens.text.primary,
  },
  detalle: {
    fontSize: "0.75rem",
    lineHeight: 1.4,
    color: theme.palette.tokens.text.secondary,
  },
}));

const SelectorModulos = ({
  disponibles = MODULOS,
  seleccion,
  onChange,
  yaCargados = [],
  disabled = false,
}) => {
  const classes = useStyles();

  const alternar = (modulo) => {
    if (seleccion.includes(modulo)) {
      // Lo que depende de este modulo se quita con el, salvo que el modulo
      // ya estuviera cargado y la dependencia siga cubierta.
      const quitar = new Set([modulo]);
      if (!yaCargados.includes(modulo)) {
        MODULOS.forEach((m) => {
          if ((DEPENDENCIAS[m] || []).includes(modulo)) quitar.add(m);
        });
      }
      onChange(seleccion.filter((m) => !quitar.has(m)));
      return;
    }

    const faltan = (DEPENDENCIAS[modulo] || []).filter(
      (d) => disponibles.includes(d) && !seleccion.includes(d) && !yaCargados.includes(d)
    );
    onChange(ordenar([...seleccion, modulo, ...faltan]));
  };

  return (
    <div className={classes.rejilla}>
      {ordenar(disponibles).map((m) => {
        const cargado = yaCargados.includes(m);
        const dependencias = DEPENDENCIAS[m] || [];

        return (
          <FormControlLabel
            key={m}
            className={classes.opcion}
            control={
              <Checkbox
                className={classes.casilla}
                color="primary"
                size="small"
                checked={cargado || seleccion.includes(m)}
                disabled={disabled || cargado}
                onChange={() => alternar(m)}
              />
            }
            label={
              <div>
                <div className={classes.nombre}>
                  {nombreModulo(m)}
                  {cargado ? ` · ${i18n.t("snapshots.loadModal.already")}` : ""}
                </div>
                <div className={classes.detalle}>
                  {i18n.t(`snapshots.modules.${m}.description`)}
                  {dependencias.length
                    ? ` ${i18n.t("snapshots.needs", {
                        deps: dependencias.map(nombreModulo).join(", "),
                        interpolation: { escapeValue: false },
                      })}`
                    : ""}
                </div>
              </div>
            }
          />
        );
      })}
    </div>
  );
};

export default SelectorModulos;
