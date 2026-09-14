import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

/**
 * Piezas compartidas por los modales de clonar configuracion y de duplicar
 * empresa: estilos, listas traducidas y el resumen que devuelve el servidor.
 */

export const useEstilosClonado = makeStyles((theme) => ({
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
  separado: {
    marginTop: theme.palette.tokens.space.md,
  },
}));

/** Lista traducida; [] si la clave no es una lista. */
export const listaTraducida = (clave) => {
  const valor = i18n.t(clave, { returnObjects: true });
  return Array.isArray(valor) ? valor : [];
};

/** Bloque con titulo y lista de puntos. Sin puntos no pinta nada. */
export const BloqueLista = ({ titulo, items, className }) => {
  const classes = useEstilosClonado();
  if (!items || !items.length) return null;
  return (
    <div className={className ? `${classes.bloque} ${className}` : classes.bloque}>
      <div className={classes.titulo}>{titulo}</div>
      <ul className={classes.lista}>
        {items.map((texto, i) => (
          <li key={i}>{texto}</li>
        ))}
      </ul>
    </div>
  );
};

/** Contadores de un apartado del resumen, con su nombre legible. */
const contadores = (datos) =>
  Object.entries(datos || {})
    .filter(([, n]) => n > 0)
    .map(
      ([clave, n]) =>
        `${i18n.t(`cloneCompany.keys.${clave}`, { defaultValue: clave })}: ${n}`
    );

/** Resumen que devuelve el servidor tras clonar. */
export const ResumenClonado = ({ resumen }) => {
  const classes = useEstilosClonado();
  if (!resumen) return null;

  const ausentes = resumen.archivos?.ausentes || [];
  const archivos = [String(resumen.archivos?.copiados || 0)];
  if (ausentes.length) {
    archivos.push(
      `${i18n.t("cloneCompany.result.missingFiles")}: ${ausentes.join(", ")}`
    );
  }

  return (
    <div className={classes.columnas}>
      <BloqueLista
        titulo={i18n.t("cloneCompany.result.copied")}
        items={contadores(resumen.copiados)}
      />
      <BloqueLista
        titulo={i18n.t("cloneCompany.result.existing")}
        items={contadores(resumen.yaExistian)}
      />
      <BloqueLista
        titulo={i18n.t("cloneCompany.result.skipped")}
        items={contadores(resumen.omitidos)}
      />
      <BloqueLista titulo={i18n.t("cloneCompany.result.files")} items={archivos} />
      <BloqueLista
        titulo={i18n.t("cloneCompany.result.warnings")}
        items={resumen.avisos || []}
      />
    </div>
  );
};
