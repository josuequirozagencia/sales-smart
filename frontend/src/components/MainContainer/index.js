import React, { memo } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";

const useStyles = makeStyles(theme => ({
	mainContainer: {
		flex: 1,
		// 16px arriba y abajo que se sumaban a los del marco. Con el marco ya
		// recortado, aqui basta con la mitad: el contenido de la pagina queda
		// separado de la barra superior sin abrir un hueco.
		padding: theme.spacing(1, 0),
		height: `calc(100% - 48px)`,
	},

	contentWrapper: {
		height: "100%",
		overflowY: "hidden",
		display: "flex",
		flexDirection: "column",
	},
}));

const MainContainer = memo(({ children }) => {
	const classes = useStyles();

	return (
		<Container className={classes.mainContainer}>
			<div className={classes.contentWrapper}>{children}</div>
		</Container>
	);
});

export default MainContainer;