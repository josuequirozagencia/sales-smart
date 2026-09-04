import React from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
	contactsHeader: {
		display: "flex",
		alignItems: "center",
		// Sin esto la cabecera era una fila que NO se partia: titulo,
		// filtros, buscador y boton tenian que caber a la fuerza en el
		// ancho disponible, y en un movil se salian de la pantalla.
		//
		// Envolver no cambia nada cuando el contenido ya cabe, asi que las
		// dieciocho pantallas que usan esta cabecera se quedan igual salvo
		// donde estaban desbordando.
		flexWrap: "wrap",
		rowGap: theme.spacing(1),
		padding: "0px 6px 6px 6px",
	},
}));

const MainHeader = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.contactsHeader}>{children}</div>;
};

export default MainHeader;
