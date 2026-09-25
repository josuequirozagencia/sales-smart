import React, { useState, useCallback, useContext, useEffect, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Hidden from "@material-ui/core/Hidden";
import { makeStyles } from "@material-ui/core/styles";
import TicketsManagerTabs from "../../components/TicketsManagerTabs";
import Ticket from "../../components/Ticket";

import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { CircularProgress } from "@material-ui/core";
import { getBackendUrl } from "../../config";
import logo from "../../assets/logo.png";
import logoDark from "../../assets/logo-black.png";

const defaultTicketsManagerWidth = 550;
// 320 y no 404: a 1366px la lista, la conversacion y la ficha no cabian y
// aparecia scroll horizontal con la ficha cortada. Con la cabecera del ticket
// ya compacta, la lista puede ceder hasta 320 sin apretar su contenido.
const minTicketsManagerWidth = 320;
const maxTicketsManagerWidth = 700;

const useStyles = makeStyles((theme) => ({
	chatContainer: {
		flex: 1,
		// Eran 2px: la lista y la conversacion quedaban pegadas al borde de
		// la pantalla y entre si. Se pasa a la escala del sistema, con un
		// paso reducido en anchos intermedios donde el espacio es mas caro.
		// Sin relleno: las tres columnas se separan con sus propios bordes. El
		// relleno de aqui, sumado al del contenido del layout, gastaba 40px por
		// lado en la pantalla donde el asesor pasa el dia.
		padding: 0,
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},
	chatPapper: {
		display: "flex",
		height: "100%",
	},
	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
		position: "relative",
		// Adicionar largura mínima como fallback
		minWidth: `${minTicketsManagerWidth}px`,
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		flexGrow: 1,
		// Con base auto, esta columna partia del ancho de su contenido y en el
		// reparto flex le quitaba ancho a la lista aunque sobrara sitio: medido
		// a 1920px, 550px guardados se veian como 428. Con base 0 la lista queda
		// en el ancho que eligio el usuario y el hilo se lleva el resto, incluido
		// lo que libera la ficha al plegarse.
		//
		// Minimo en 480 y no en auto. Con auto, el hilo pedia el ancho entero de
		// la cabecera del ticket (unos 770px) y a 1366 empujaba la ficha fuera de
		// la pantalla: de ahi el scroll horizontal. Con 0 pasaria lo contrario, el
		// hilo se encogeria hasta recortar los botones de la cabecera, que no se
		// reacomodan en escritorio. 480 es lo que necesita la cabecera ya compacta
		// (nombre recortado y botones de 36px), y quien cede primero es la lista.
		flexBasis: 0,
		minWidth: 480,
	},
	welcomeMsg: {
		background: theme.palette.tabHeaderBackground,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
	// Separador arrastrable entre la lista y la conversacion.
	//
	// Tenia "#ddd" y "#f4f7f9" escritos a mano: en modo oscuro quedaba como
	// una barra clara atravesando la pantalla. Ahora sale de los tokens y se
	// tine con el color de marca al pasar por encima, para que se entienda
	// que es arrastrable.
	dragger: {
		width: "5px",
		cursor: "ew-resize",
		padding: "4px 0 0",
		borderTop: `1px solid ${theme.palette.divider}`,
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		zIndex: 100,
		backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
		userSelect: "none",
		transition: "background-color 180ms ease",
		"&:hover": {
			backgroundColor: theme.palette.primary.main,
		},
	},
	logo: {
		logo: theme.logo,
		content: "url(" + (theme.mode === "light" 
			? theme.calculatedLogoLight() 
			: theme.calculatedLogoDark()) + ")"
	},
}));

const TicketsCustom = () => {
	const { user } = useContext(AuthContext);
	
	// ⚠️ CORREÇÃO PRINCIPAL: Inicializar com largura padrão adequada
	const [ticketsManagerWidth, setTicketsManagerWidth] = useState(
		user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth
	);
	
	const classes = useStyles({ ticketsManagerWidth });
	const { ticketId } = useParams();
	const ticketsManagerWidthRef = useRef(ticketsManagerWidth);
	// Borde izquierdo real de la lista: el arrastre media desde el borde de la
	// ventana, asi que la lista acababa mas ancha que donde estaba el puntero.
	const contactsWrapperRef = useRef(null);

	// ⚠️ CORREÇÃO: useEffect mais robusto para inicialização
	useEffect(() => {
		// Definir largura baseada no usuário ou padrão
		const initialWidth = user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth;
		
		// Garantir que a largura esteja dentro dos limites
		const validWidth = Math.max(
			minTicketsManagerWidth,
			Math.min(maxTicketsManagerWidth, initialWidth)
		);
		
		setTicketsManagerWidth(validWidth);
		ticketsManagerWidthRef.current = validWidth;
	}, [user]);

	const handleMouseDown = (e) => {
		document.addEventListener("mouseup", handleMouseUp, true);
		document.addEventListener("mousemove", handleMouseMove, true);
	};

	const handleSaveContact = async (value) => {
		// Garantir largura mínima antes de salvar
		const validValue = Math.max(minTicketsManagerWidth, value);
		
		try {
			await api.put(`/users/toggleChangeWidht/${user.id}`, { 
				defaultTicketsManagerWidth: validValue 
			});
		} catch (error) {
			console.error("Erro ao salvar largura:", error);
		}
	};

	const handleMouseMove = useCallback((e) => {
		const izquierda = contactsWrapperRef.current?.getBoundingClientRect().left ?? 0;
		const newWidth = e.clientX - izquierda;
		
		if (newWidth >= minTicketsManagerWidth && newWidth <= maxTicketsManagerWidth) {
			ticketsManagerWidthRef.current = newWidth;
			setTicketsManagerWidth(newWidth);
		}
	}, []);

	const handleMouseUp = async () => {
		document.removeEventListener("mouseup", handleMouseUp, true);
		document.removeEventListener("mousemove", handleMouseMove, true);

		const newWidth = ticketsManagerWidthRef.current;

		if (newWidth !== ticketsManagerWidth) {
			await handleSaveContact(newWidth);
		}
	};

	// ⚠️ CORREÇÃO: Garantir que a largura nunca seja 0 ou inválida
	const effectiveWidth = Math.max(minTicketsManagerWidth, ticketsManagerWidth);

	return (
		<QueueSelectedProvider>
			<div className={classes.chatContainer}>
				<div className={classes.chatPapper}>
					<div
						ref={contactsWrapperRef}
						className={classes.contactsWrapper}
						style={{ 
							width: `${effectiveWidth}px`,
							// Adicionar fallbacks importantes
							minWidth: `${minTicketsManagerWidth}px`,
							maxWidth: `${maxTicketsManagerWidth}px`,
							// Garantir visibilidade
							opacity: effectiveWidth > 0 ? 1 : 0,
							visibility: effectiveWidth > 0 ? 'visible' : 'hidden'
						}}
					>
						<TicketsManagerTabs />
						<div 
							onMouseDown={handleMouseDown} 
							className={classes.dragger} 
						/>
					</div>
					<div className={classes.messagesWrapper}>
						{ticketId ? (
							<Ticket />
						) : (
							<Hidden only={["sm", "xs"]}>
								<Paper square variant="outlined" className={classes.welcomeMsg}>
									<span>
										<center>
											<img className={classes.logo} width="50%" alt="" />
										</center>
										{i18n.t("chat.noTicketMessage")}
									</span>
								</Paper>
							</Hidden>
						)}
					</div>
				</div>
			</div>
		</QueueSelectedProvider>
	);
};

export default TicketsCustom;