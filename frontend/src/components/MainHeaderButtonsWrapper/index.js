import React from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
	MainHeaderButtonsWrapper: {
		// "none" impedia encoger, asi que el grupo empujaba fuera de la
		// pantalla en vez de adaptarse. Ahora encoge y sus piezas envuelven.
		flex: "0 1 auto",
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(1),
		},
	},
}));

const MainHeaderButtonsWrapper = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
