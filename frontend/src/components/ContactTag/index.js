import { makeStyles, useTheme } from "@material-ui/core/styles";
import React from "react";

const useStyles = makeStyles(theme => ({
    tag: {
        padding: "2px 7px",
        // 3px era casi un angulo recto; 6 encaja con la escala de radios.
        borderRadius: 6,
        fontSize: "0.6875rem",
        fontWeight: 500,
        letterSpacing: "0.02em",
        marginRight: 4,
        marginTop: 2,
        // Antes era nowrap sin limite: una etiqueta de nombre largo empujaba
        // la fila del ticket entera.
        maxWidth: 160,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "inline-block",
    }
}));

const ContactTag = ({ tag }) => {
    const classes = useStyles();
    const theme = useTheme();

    // El color de la etiqueta se genera al azar al crearla y se guarda en la
    // base. El texto estaba fijado en blanco, asi que cualquier color claro
    // dejaba la etiqueta ilegible: en esta instalacion "ASIGNADO" daba 3.37
    // de contraste.
    //
    // onColor elige blanco o tinta oscura segun el fondo, con el mismo
    // criterio que ya usan las insignias del ticket y TagsContainer.
    const fondo = tag.color || theme.palette.tokens.surface.surfaceSecondary;

    return (
        <div
            className={classes.tag}
            style={{
                backgroundColor: fondo,
                color: theme.palette.tokens.onColor(fondo),
            }}
            title={tag.name}
        >
            {tag.name.toUpperCase()}
        </div>
    )
}

export default ContactTag;
