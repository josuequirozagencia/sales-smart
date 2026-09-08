import React, { useEffect } from "react";

import { Card, IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
// Flecha del set propio. ArrowBackIos venia relleno y con el hueco
// asimetrico de Material, que en una barra de iconos en trazo se notaba.
import { ArrowBack } from "../Icons";
import { useHistory } from "react-router-dom";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		alignItems: "center",
		gap: theme.palette.tokens.space.xs,
		// La superficie de la barra sale del token, no de palette.total: asi
		// es la misma que la del panel de contacto y la del hilo, y cambia
		// sola al pasar a modo oscuro.
		background: theme.palette.tokens.surface.surface,
		flex: "none",
		// El borde era negro al 12% escrito a mano; sobre fondo oscuro se veia
		// como una linea sucia en lugar de un separador.
		borderBottom: `1px solid ${theme.palette.tokens.border.border}`,
		// Altura minima en vez de fija: con 65px exactos, la barra recortaba
		// el contenido en cuanto el nombre del contacto pasaba a dos lineas.
		minHeight: 64,
		padding: theme.spacing(0, 0.5),
		[theme.breakpoints.down("sm")]: {
			flexWrap: "wrap",
			height: "max-content",
			paddingTop: theme.palette.tokens.space.xs,
			paddingBottom: theme.palette.tokens.space.xs,
		},
	},
	backButton: {
		flexShrink: 0,
		color: theme.palette.tokens.text.secondary,
	},
}));

const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();
	const history = useHistory();

	const handleBack = () => {

		history.push("/tickets");
	};

	// useEffect(() => {
	// 	const handleKeyDown = (event) => {
	// 		if (event.key === "Escape") {
	// 			handleBack();
	// 		}
	// 	};
	// 	document.addEventListener("keydown", handleKeyDown);
	// 	return () => {
	// 		document.removeEventListener("keydown", handleKeyDown);
	// 	};
	// }, [history]);

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					square
					className={classes.ticketHeader}
				>
					<IconButton
						className={classes.backButton}
						onClick={handleBack}
						aria-label={i18n.t("messagesList.header.buttons.back")}
					>
						<ArrowBack />
					</IconButton>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
