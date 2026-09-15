import React, { useEffect, useState, useContext, useRef } from "react";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
// Iconos en trazo del set propio del proyecto — ver components/Icons.
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CloseIcon,
  GroupIcon,
  PermIdentityIcon,
  PersonIcon,
  CreateIcon,
  MonetizationOnOutlinedIcon,
  EventAvailableOutlinedIcon,
  SearchIcon,
  ClearIcon,
  BlockIcon,
  LockOpenIcon,
  AccountTree,
} from "../Icons";
import formatSerializedId from '../../utils/formatSerializedId';
import { i18n } from "../../translate/i18n";
import ModalImageCors from "../ModalImageCors";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import { 
	Badge,
	ButtonBase,
	CardHeader, 
	Switch, 
	Tabs, 
	Tab, 
	Box,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	ListItemIcon,
	ListItemSecondaryAction,
	Divider,
	CircularProgress,
	Grid,
	Chip,
	TextField,
	InputAdornment,
	Collapse,
	Dialog,
	DialogContent,
	Tooltip
} from "@material-ui/core";
import { ContactForm } from "../ContactForm";
import ContactModal from "../ContactModal";
import ContactAvatar from "../ContactAvatar";
import SaleModal from "../SaleModal";
import AppointmentModal from "../AppointmentModal";
import { ContactNotes } from "../ContactNotes";
import {
  ImageIcon,
  VideocamIcon,
  AudiotrackIcon,
  InsertDriveFileIcon,
  LinkIcon,
  InfoIcon,
  MessageIcon,
} from "../Icons";

import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { toast } from "react-toastify";
import { TagsKanbanContainer } from "../TagsKanbanContainer";
import GhlWorkflowModal from "../GhlWorkflowModal";
// El mismo modal que usan la lista y las acciones del ticket: cambiar de
// responsable ya existe, aqui solo se le da otra puerta de entrada.
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import { format, parseISO } from "date-fns";

const drawerWidth = 320;
// Ancho de la ficha plegada en escritorio. Deja sitio al boton de expandir y a
// un avatar de 36px con su margen, como los iconos del menu lateral.
const railWidth = 56;

const useStyles = makeStyles(theme => ({
	drawer: {
		width: drawerWidth,
		flexShrink: 0,
		transition: theme.transitions.create("width", {
			easing: theme.transitions.easing.sharp,
			duration: theme.transitions.duration.enteringScreen,
		}),
		// 320px fijos ocupan el 85% de un telefono de 375 y no caben en uno
		// de 320. Se limita al ancho disponible dejando un margen para que se
		// vea que hay contenido detras y quede sitio para cerrarlo.
		[theme.breakpoints.down("xs")]: {
			width: "min(320px, calc(100vw - 48px))",
		},
	},
	// Medido en el navegador: en la variante temporal el panel salia pegado
	// al borde IZQUIERDO. MUI da left:auto a los cajones anclados a la
	// derecha, pero aqui algo lo pisa y left acaba en 0, que con un ancho
	// fijo gana a right. Se fija a mano, y solo en superpuesto: en la
	// variante acoplada el panel va en el flujo y estas dos propiedades
	// sobran.
	drawerPaperSuperpuesto: {
		left: "auto",
		right: 0,
	},
	tabChip: {
		minHeight: 16,
		height: 16,
		fontSize: "0.7rem",
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.primary.contrastText,
		marginLeft: 4,
	},
	drawerPaper: {
		width: drawerWidth,
		[theme.breakpoints.down("xs")]: {
			width: "min(320px, calc(100vw - 48px))",
		},
		display: "flex",
		flexDirection: "column",
		// Los bordes eran negro al 12% escrito a mano, que sobre fondo oscuro
		// se ve como una linea sucia. El divisor del tema ya se adapta.
		borderTop: `1px solid ${theme.palette.divider}`,
		borderRight: `1px solid ${theme.palette.divider}`,
		borderBottom: `1px solid ${theme.palette.divider}`,
		// 4px es casi un angulo recto; 12 es el paso de tarjetas del sistema.
		borderTopRightRadius: theme.palette.tokens.radius.lg,
		borderBottomRightRadius: theme.palette.tokens.radius.lg,
		height: "100%",
		overflow: "hidden", // Importante para evitar overflow no drawer principal
		transition: theme.transitions.create("width", {
			easing: theme.transitions.easing.sharp,
			duration: theme.transitions.duration.enteringScreen,
		}),
	},
	// Ficha plegada en escritorio: la columna se queda como un riel en vez de
	// desaparecer, y el hilo de la conversacion ocupa el resto. Solo en la
	// variante acoplada; superpuesta (menos de 960px) sigue abriendo y cerrando.
	drawerPlegado: {
		width: railWidth,
	},
	drawerPaperPlegado: {
		width: railWidth,
	},
	riel: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(1),
		paddingTop: theme.spacing(1),
	},
	rielAvatar: {
		cursor: "pointer",
	},
	header: {
		display: "flex",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		backgroundColor: theme.palette.inputBackground,
		alignItems: "center",
		padding: theme.spacing(0, 1),
		minHeight: "50px",
		justifyContent: "flex-start",
		flexShrink: 0,
	},
	profileSection: {
		flexShrink: 0,
		backgroundColor: theme.palette.inputBackground,
	},
	searchContainer: {
		padding: theme.spacing(1, 2),
		backgroundColor: theme.palette.background.paper,
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		flexShrink: 0,
	},
	searchField: {
		"& .MuiOutlinedInput-root": {
			height: 40,
		}
	},
	searchResults: {
		maxHeight: 200,
		overflow: "auto",
		...theme.scrollbarStyles,
	},
	searchResultItem: {
		padding: theme.spacing(1),
		cursor: "pointer",
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
	},
	searchResultText: {
		fontSize: "0.85rem",
		"& mark": {
			backgroundColor: theme.palette.primary.light,
			color: theme.palette.primary.contrastText,
			padding: "0 2px",
			borderRadius: 2,
		}
	},
	searchResultDate: {
		fontSize: "0.75rem",
		color: theme.palette.text.secondary,
		marginTop: 4,
	},
	emptySearchState: {
		textAlign: "center",
		padding: theme.spacing(2),
		color: theme.palette.text.secondary,
		fontSize: "0.85rem",
	},
	// Barra de pestanas segmentada: una pastilla gris que contiene todas las
	// pestanas y en la que la activa se levanta sobre superficie propia. Antes
	// era la barra de serie, con subrayado y separada del contenido por una
	// linea negra al 12% que en modo oscuro se veia sucia.
	tabsContainer: {
		backgroundColor: theme.palette.background.paper,
		flexShrink: 0,
		// La ficha se desplaza entera (ver contentWrapper): las pestanas se quedan
		// arriba al bajar, para cambiar de pestana sin volver al principio.
		position: "sticky",
		top: 0,
		zIndex: 2,
		padding: theme.palette.tokens.space.xs,
		borderBottom: `1px solid ${theme.palette.divider}`,
		"& .MuiTabs-scroller": {
			backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
			borderRadius: theme.palette.tokens.radius.md,
			padding: 3,
		},
		"& .MuiTabs-flexContainer": {
			gap: 2,
		},
		// El subrayado sobra: la pestana activa ya se distingue por su pastilla.
		"& .MuiTabs-indicator": {
			display: "none",
		},
	},
	// Antes el cuerpo no se desplazaba (overflow hidden) y el perfil, que no
	// encoge, dejaba al panel de la pestana solo el hueco sobrante: en una
	// pantalla de 900px de alto eran unos 100px con su propio scroll, y los
	// datos y las observaciones no se llegaban a ver. Ahora se desplaza la ficha
	// entera y cada panel ocupa lo que mide su contenido.
	contentWrapper: {
		display: "flex",
		flexDirection: "column",
		height: "calc(100% - 50px)",
		overflowY: "auto",
		overflowX: "hidden",
		...theme.scrollbarStyles,
	},
	scrollableContent: {
		flex: "1 0 auto",
		display: "flex",
		flexDirection: "column",
	},
	tabPanel: {
		padding: theme.spacing(1),
	},
	// Avatar redondo e menor
	contactAvatar: {
		width: 80,
		height: 80,
		borderRadius: "50%",
		margin: theme.spacing(1),
		border: `2px solid ${theme.palette.primary.main}`,
		cursor: "pointer", // Adicionar cursor pointer
		"&:hover": {
			opacity: 0.8,
		},
	},
	contactHeader: {
		display: "flex",
		padding: theme.spacing(1),
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		"& > *": {
			margin: theme.spacing(0.5),
		},
	},
	contactDetails: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	contactExtraInfo: {
		marginTop: 4,
		padding: 6,
	},
	switchContainer: {
		padding: theme.spacing(1, 2),
		backgroundColor: theme.palette.background.paper,
		marginBottom: theme.spacing(1),
		flexShrink: 0,
	},
	mediaGrid: {
		padding: theme.spacing(1),
	},
	mediaItem: {
		cursor: "pointer",
		transition: "transform 0.2s",
		"&:hover": {
			transform: "scale(1.05)",
		},
		borderRadius: theme.spacing(1),
		overflow: "hidden",
		height: 100,
		backgroundColor: theme.palette.action.hover,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	mediaThumbnail: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
	},
	mediaIcon: {
		fontSize: 40,
		color: theme.palette.text.secondary,
	},
	loadingContainer: {
		display: "flex",
		justifyContent: "center",
		padding: theme.spacing(3),
	},
	emptyState: {
		textAlign: "center",
		padding: theme.spacing(3),
		color: theme.palette.text.secondary,
	},
	linkItem: {
		padding: theme.spacing(1),
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
		borderRadius: theme.spacing(0.5),
		marginBottom: theme.spacing(0.5),
	},
	// Novos estilos para os ícones de ação
	// Cuadricula de acciones.
	//
	// Antes era una fila de iconos sueltos sin texto: habia que pasar el
	// raton por encima y esperar al tooltip para saber que hacia cada uno,
	// y en una pantalla tactil no hay hover, asi que el tooltip no llega
	// nunca. Con la etiqueta debajo se lee de una vez.
	//
	// auto-fit con minmax reparte las cinco tarjetas en las columnas que
	// quepan: tres en el ancho normal del panel, dos si se estrecha.
	contactActions: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
		gap: theme.palette.tokens.space.sm,
		marginTop: theme.palette.tokens.space.md,
		width: "100%",
	},
	actionCard: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		padding: theme.palette.tokens.space.sm,
		minHeight: 64,
		borderRadius: theme.palette.tokens.radius.md,
		backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
		border: "1px solid transparent",
		cursor: "pointer",
		transition: "background-color 160ms ease, border-color 160ms ease",
		"&:hover": {
			backgroundColor:
				theme.mode === "light"
					? `${theme.palette.primary.main}14`
					: `${theme.palette.primary.main}26`,
			borderColor: `${theme.palette.primary.main}40`,
		},
		// Sin esto, una tarjeta deshabilitada seguiria pareciendo pulsable.
		"&:disabled": {
			opacity: 0.5,
			cursor: "default",
		},
	},
	actionCardLabel: {
		// 11px es el minimo del sistema. La etiqueta es corta a proposito:
		// dos palabras como mucho, para que no se parta en dos lineas.
		fontSize: "0.6875rem",
		fontWeight: 600,
		lineHeight: 1.2,
		textAlign: "center",
		color: theme.palette.tokens.text.secondary,
		textTransform: "none",
	},
	// Canal y estado, debajo del nombre. Cada uno es un punto de color con su
	// texto al lado: el punto solo no le dice nada a quien no distingue los
	// colores, y el texto solo se pierde entre el resto de datos.
	statusRow: {
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: theme.palette.tokens.space.xs,
		marginTop: theme.palette.tokens.space.xs,
	},
	statusPill: {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "3px 10px",
		borderRadius: theme.palette.tokens.radius.full,
		backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
		fontSize: "0.6875rem",
		fontWeight: 600,
		lineHeight: 1.4,
		color: theme.palette.tokens.text.secondary,
		whiteSpace: "nowrap",
	},
	// El punto acompana al texto, no lo sustituye, asi que no carga el
	// significado por si solo y no se le exige el contraste de 3:1.
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: "50%",
		flexShrink: 0,
		backgroundColor: theme.palette.tokens.text.muted,
	},
	// Definidos despues de statusDot a proposito: con la misma especificidad,
	// JSS aplica la ultima regla escrita.
	dotWhatsapp: { backgroundColor: "#25D366" },
	dotInstagram: { backgroundColor: "#e1306c" },
	dotFacebook: { backgroundColor: "#3b5998" },
	dotOpen: { backgroundColor: theme.palette.tokens.semantic.success.fill },
	dotPending: { backgroundColor: theme.palette.tokens.semantic.warning.fill },
	dotClosed: { backgroundColor: theme.palette.tokens.text.muted },
	// Datos del ticket como pares etiqueta/valor alineados en dos columnas.
	infoBlock: {
		marginTop: theme.palette.tokens.space.sm,
		padding: theme.palette.tokens.space.md,
		display: "flex",
		flexDirection: "column",
	},
	infoTitle: {
		fontSize: "0.6875rem",
		fontWeight: 700,
		letterSpacing: "0.06em",
		textTransform: "uppercase",
		color: theme.palette.tokens.text.muted,
		marginBottom: theme.palette.tokens.space.sm,
	},
	infoRow: {
		display: "grid",
		// Columna de etiqueta de ancho fijo: con dos fracciones, las etiquetas
		// cortas dejaban su valor descolgado a media fila.
		gridTemplateColumns: "84px 1fr",
		alignItems: "baseline",
		gap: theme.palette.tokens.space.sm,
		padding: "3px 0",
	},
	infoLabel: {
		fontSize: "0.6875rem",
		color: theme.palette.tokens.text.muted,
	},
	infoValue: {
		fontSize: "0.8125rem",
		color: theme.palette.tokens.text.primary,
		wordBreak: "break-word",
	},
	infoValueRow: {
		display: "flex",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.palette.tokens.space.sm,
	},
	infoAction: {
		fontSize: "0.6875rem",
		fontWeight: 600,
		color: theme.palette.primary.main,
		textTransform: "none",
		padding: "0 4px",
		minWidth: 0,
		flexShrink: 0,
	},
	actionIcon: {
		backgroundColor: theme.palette.background.paper,
		border: `1px solid ${theme.palette.divider}`,
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
	},
	editIcon: {
		color: theme.palette.primary.main,
	},
	blockIcon: {
		color: theme.palette.error.main,
	},
	unblockIcon: {
		color: theme.palette.success.main,
	},
	tabIcon: {
		// 48 de alto sobraban para un icono de 24: la barra ocupaba mas que
		// varias filas de datos del panel.
		minHeight: 40,
		minWidth: 44,
		// Reparten el ancho sobrante entre todas: si no, la pastilla gris
		// se quedaba con un hueco vacio a la derecha. Cuando no cabe, cada
		// una vuelve a sus 44 y la barra se desplaza, como ya hacia.
		flexGrow: 1,
		padding: theme.spacing(0.5, 1),
		borderRadius: theme.palette.tokens.radius.sm,
		color: theme.palette.tokens.text.muted,
		// MUI atenua las pestanas inactivas al 70%; el color del token ya
		// establece la jerarquia y con la opacidad encima se quedaba corto.
		opacity: 1,
		transition: "background-color 160ms ease, color 160ms ease",
		"&.Mui-selected": {
			backgroundColor: theme.palette.tokens.surface.surface,
			color: theme.palette.primary.main,
			boxShadow: theme.palette.tokens.shadow.sm,
		},
	},
	// Garantir que o CardHeader não cause overflow
	contactCardHeader: {
		width: '100%',
		padding: theme.spacing(1),
	},
	participantsList: {
		padding: 0,
	},
	participantItem: {
		paddingLeft: theme.spacing(1),
		paddingRight: theme.spacing(1),
		marginBottom: theme.spacing(0.5),
		borderRadius: theme.spacing(1),
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
	},
	participantAvatar: {
		width: 45,
		height: 45,
	},
	adminIcon: {
		color: theme.palette.warning.main,
		fontSize: 16,
		backgroundColor: theme.palette.background.paper,
		borderRadius: "50%",
		padding: 2,
	},
	superAdminIcon: {
		color: theme.palette.error.main,
		fontSize: 16,
		backgroundColor: theme.palette.background.paper,
		borderRadius: "50%",
		padding: 2,
	},
	adminChip: {
		backgroundColor: theme.palette.warning.light,
		color: theme.palette.warning.contrastText,
		fontSize: "0.7rem",
	},
	superAdminChip: {
		backgroundColor: theme.palette.error.light,
		color: theme.palette.error.contrastText,
		fontSize: "0.7rem",
	},
	// Estilos para o modal da imagem
	imageModal: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	imageModalContent: {
		outline: "none",
		maxWidth: "90vw",
		maxHeight: "90vh",
	},
	expandedImage: {
		width: "100%",
		height: "auto",
		maxWidth: "500px",
		borderRadius: theme.spacing(1),
	},
	// El contenido de la ficha se oculta, no se desmonta: al volver a
	// expandirla sigue en la misma pestana y con lo que ya habia cargado, igual
	// que cuando el cajon persistente estaba cerrado. Va la ultima porque JSS
	// aplica las reglas en orden y header y contentWrapper declaran display.
	ocultoPlegado: {
		display: "none",
	},
}));

function TabPanel(props) {
	const { children, value, index, ...other } = props;

	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`contact-tabpanel-${index}`}
			aria-labelledby={`contact-tab-${index}`}
			style={{
				display: value === index ? "flex" : "none",
				flexDirection: "column",
			}}
			{...other}
		>
			{value === index && (
				<div className={props.classes?.tabPanel}>
					{children}
				</div>
			)}
		</div>
	);
}

const ContactDrawer = ({ open, handleDrawerClose, handleDrawerOpen, contact, ticket, loading, superpuesto = false }) => {
	const classes = useStyles();
	const plegado = !superpuesto && !open;

	const [modalOpen, setModalOpen] = useState(false);
	const [saleModalOpen, setSaleModalOpen] = useState(false);
	const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
	const [transferModalOpen, setTransferModalOpen] = useState(false);
	const [flujoModalOpen, setFlujoModalOpen] = useState(false);
	const [blockingContact, setBlockingContact] = useState(contact.active);
	const [openForm, setOpenForm] = useState(false);
	const [tabValue, setTabValue] = useState(0);
	// Referencia a la seccion de notas, que vive DENTRO de la primera
	// pestana. No hay una pestana de notas propia: el boton de la
	// cuadricula lleva a la que ya existe, no crea nada nuevo.
	const notasRef = useRef(null);
	const [mediaData, setMediaData] = useState({ images: [], videos: [], audios: [], documents: [], links: [] });
	const [loadingMedia, setLoadingMedia] = useState(false);
	const { get } = useCompanySettings();
	const [hideNum, setHideNum] = useState(false);
	const { user } = useContext(AuthContext);
	const [acceptAudioMessage, setAcceptAudio] = useState(contact.acceptAudioMessage);
	const [imageModalOpen, setImageModalOpen] = useState(false); // Estado para o modal da imagem
	

	const [participants, setParticipants] = useState([]);
	const [loadingParticipants, setLoadingParticipants] = useState(false);


	// Estados para pesquisa
	const [searchTerm, setSearchTerm] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [showSearchResults, setShowSearchResults] = useState(false);
	const [searchTimeout, setSearchTimeout] = useState(null);

// Função para buscar participantes do grupo
const fetchGroupParticipants = async () => {
	if (!contact.isGroup) return;
	
	setLoadingParticipants(true);
	try {
		const { data } = await api.get(`/contacts/${contact.id}/participants`);
		setParticipants(data);
	} catch (err) {
		console.error("Erro ao buscar participantes do grupo:", err);
		toastError("Erro ao carregar participantes do grupo");
		setParticipants([]);
	} finally {
		setLoadingParticipants(false);
	}
};

	useEffect(() => {
		async function fetchData() {
			const lgpdHideNumber = await get({
				"column": "lgpdHideNumber"
			});

			if (lgpdHideNumber === "enabled") setHideNum(true);
		}
		fetchData();
	}, []);

	useEffect(() => {
		setAcceptAudio(contact.acceptAudioMessage);
		setOpenForm(false);
		setTabValue(0);
		// Limpar pesquisa ao trocar de contato
		setSearchTerm("");
		setSearchResults([]);
		setShowSearchResults(false);
		setParticipants([]); // Limpar participantes
		
		if (open && contact.id) {
			fetchMediaData();
			// Buscar participantes apenas se for um grupo
			if (contact.isGroup) {
				fetchGroupParticipants();
			}
		}
	}, [open, contact]);

	// Função para abrir modal da imagem
	const handleImageClick = () => {
		if (contact?.urlPicture) {
			setImageModalOpen(true);
		}
	};

	// Função para fechar modal da imagem
	const handleImageModalClose = () => {
		setImageModalOpen(false);
	};

	// Função para buscar mensagens
	const searchMessages = async (searchParam) => {
		if (!searchParam || searchParam.trim().length < 2) {
			setSearchResults([]);
			setShowSearchResults(false);
			return;
		}

		setSearchLoading(true);
		try {
			const { data } = await api.get(`/contacts/${contact.id}/messages/search`, {
				params: { searchParam: searchParam.trim() }
			});
			
			setSearchResults(data.messages || []);
			setShowSearchResults(true);
		} catch (err) {
			console.error("Erro ao buscar mensagens:", err);
			toastError(err);
			setSearchResults([]);
		} finally {
			setSearchLoading(false);
		}
	};

	// Handler para mudança no campo de pesquisa com debounce
	const handleSearchChange = (event) => {
		const value = event.target.value;
		setSearchTerm(value);

		// Clear timeout anterior
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		// Definir novo timeout para debounce
		const newTimeout = setTimeout(() => {
			searchMessages(value);
		}, 500);

		setSearchTimeout(newTimeout);
	};

	// Limpar pesquisa
	const clearSearch = () => {
		setSearchTerm("");
		setSearchResults([]);
		setShowSearchResults(false);
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
	};

	// Destacar texto na pesquisa
	const highlightSearchTerm = (text) => {
		if (!searchTerm || !text) return text;
		
		const regex = new RegExp(`(${searchTerm})`, 'gi');
		return text.replace(regex, '<mark>$1</mark>');
	};

	// Navegar para mensagem (placeholder - implementar conforme necessário)
	const handleGoToMessage = (message) => {
		// Aqui você pode implementar a navegação para a mensagem específica
		console.log("Navegar para mensagem:", message);
		toast.info(`Mensagem encontrada: ${message.body.substring(0, 50)}...`);
		setShowSearchResults(false);
	};

	const fetchMediaData = async () => {
		setLoadingMedia(true);
		try {
			const { data } = await api.get(`/contacts/${contact.id}/media`);
			// Garantir que as URLs das mídias estejam corretas
			const processedData = {
				images: data.images.map(item => ({
					...item,
					mediaUrl: item.mediaUrl && !item.mediaUrl.startsWith('http') 
						? `${process.env.REACT_APP_BACKEND_URL}${item.mediaUrl}`
						: item.mediaUrl
				})),
				videos: data.videos.map(item => ({
					...item,
					mediaUrl: item.mediaUrl && !item.mediaUrl.startsWith('http')
						? `${process.env.REACT_APP_BACKEND_URL}${item.mediaUrl}`
						: item.mediaUrl
				})),
				audios: data.audios.map(item => ({
					...item,
					mediaUrl: item.mediaUrl && !item.mediaUrl.startsWith('http')
						? `${process.env.REACT_APP_BACKEND_URL}${item.mediaUrl}`
						: item.mediaUrl
				})),
				documents: data.documents.map(item => ({
					...item,
					mediaUrl: item.mediaUrl && !item.mediaUrl.startsWith('http')
						? `${process.env.REACT_APP_BACKEND_URL}${item.mediaUrl}`
						: item.mediaUrl
				})),
				links: data.links
			};
			setMediaData(processedData);
		} catch (err) {
			toastError(err);
			setMediaData({
				images: [],
				videos: [],
				audios: [],
				documents: [],
				links: []
			});
		} finally {
			setLoadingMedia(false);
		}
	};

	const renderParticipants = () => {
		if (loadingParticipants) {
			return (
				<div className={classes.loadingContainer}>
					<CircularProgress size={40} />
				</div>
			);
		}
	
		if (participants.length === 0) {
			return (
				<div className={classes.emptyState}>
					<Typography variant="body2">
						Nenhum participante encontrado
					</Typography>
				</div>
			);
		}
	
		return (
			<List className={classes.participantsList}>
				{participants.map((participant) => (
					<ListItem key={participant.id} className={classes.participantItem}>
						<ListItemAvatar>
							<Badge
								overlap="circular"
								anchorOrigin={{
									vertical: 'bottom',
									horizontal: 'right',
								}}
								badgeContent={
									participant.isSuperAdmin ? (
										<PermIdentityIcon className={classes.superAdminIcon} />
									) : participant.isAdmin ? (
										<PermIdentityIcon className={classes.adminIcon} />
									) : null
								}
							>
								{/* El participante trae la foto en profilePicUrl, no en
								    urlPicture, asi que se adapta al nombre que espera
								    ContactAvatar. */}
								<ContactAvatar
									contact={{
										id: participant.id,
										name: participant.name,
										urlPicture: participant.profilePicUrl,
									}}
									size={45}
									className={classes.participantAvatar}
								/>
							</Badge>
						</ListItemAvatar>
						<ListItemText
							primary={
								<Typography variant="subtitle2" noWrap>
									{participant.name}
								</Typography>
							}
							secondary={
								<Typography variant="caption" color="textSecondary" noWrap>
									{formatSerializedId(participant.number)}
								</Typography>
							}
						/>
						<ListItemSecondaryAction>
							{participant.isSuperAdmin && (
								<Chip 
									size="small" 
									label="Super Admin" 
									className={classes.superAdminChip}
									icon={<PermIdentityIcon />}
								/>
							)}
							{participant.isAdmin && !participant.isSuperAdmin && (
								<Chip 
									size="small" 
									label="Admin" 
									className={classes.adminChip}
									icon={<PersonIcon />}
								/>
							)}
						</ListItemSecondaryAction>
					</ListItem>
				))}
			</List>
		);
	};

	const handleContactToggleAcceptAudio = async () => {
		try {
			const contact = await api.put(`/contacts/toggleAcceptAudio/${ticket.contact.id}`);
			setAcceptAudio(contact.data.acceptAudioMessage);
		} catch (err) {
			toastError(err);
		}
	};

	const handleBlockContact = async (contactId) => {
		try {
			await api.put(`/contacts/block/${contactId}`, { active: false });
			toast.success("Contato bloqueado");
		} catch (err) {
			toastError(err);
		}
		setBlockingContact(true);
	};

	const handleUnBlockContact = async (contactId) => {
		try {
			await api.put(`/contacts/block/${contactId}`, { active: true });
			toast.success("Contato desbloqueado");
		} catch (err) {
			toastError(err);
		}
		setBlockingContact(false);
	};

	// Lleva a la seccion de notas: primero cambia a la pestana que la
	// contiene y despues desplaza hasta ella. El desplazamiento va en un
	// tiempo de espera porque la pestana aun no esta montada en el momento
	// del clic, y sin eso la referencia seria nula.
	const irANotas = () => {
		setTabValue(0);
		setTimeout(() => {
			if (notasRef.current) {
				notasRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}, 120);
	};

	// Canal y estado. Los datos vienen tal cual del ticket; lo unico que se
	// anade es como nombrarlos y de que color pintar su punto. Un canal o un
	// estado que no este en la tabla simplemente no pinta insignia, en vez de
	// mostrar el identificador interno.
	const CANALES = {
		whatsapp: { etiqueta: "WhatsApp", punto: classes.dotWhatsapp },
		whatsappapi: { etiqueta: "WhatsApp API", punto: classes.dotWhatsapp },
		instagram: { etiqueta: "Instagram", punto: classes.dotInstagram },
		facebook: { etiqueta: "Facebook", punto: classes.dotFacebook },
	};
	const PUNTOS_ESTADO = {
		open: classes.dotOpen,
		pending: classes.dotPending,
		closed: classes.dotClosed,
		group: classes.dotClosed,
	};

	const canal = ticket?.channel ? CANALES[ticket.channel] : null;
	const estado = ticket?.status && PUNTOS_ESTADO[ticket.status]
		? {
			etiqueta: i18n.t(`contactDrawer.status.${ticket.status}`),
			punto: PUNTOS_ESTADO[ticket.status],
		}
		: null;

	// La lista de conversaciones ya usa updatedAt como hora del ultimo
	// mensaje; aqui se lee el mismo campo para que no digan cosas distintas.
	const fechaUltimoMensaje = (() => {
		if (!ticket?.updatedAt) return null;
		try {
			return format(parseISO(ticket.updatedAt), "dd/MM/yyyy HH:mm");
		} catch (e) {
			return null;
		}
	})();

	const telefonoVisible = contact?.number
		? (hideNum && user.profile === "user"
			? formatSerializedId(contact.number).slice(0, -6) + "**-**" + contact.number.slice(-2)
			: formatSerializedId(contact.number))
		: null;

	const handleTabChange = (event, newValue) => {
		setTabValue(newValue);
		// Limpar pesquisa ao trocar de aba
		if (newValue !== 0) {
			clearSearch();
		}
	};

	const renderSearchResults = () => {
		if (searchLoading) {
			return (
				<div className={classes.emptySearchState}>
					<CircularProgress size={20} />
					<Typography variant="caption" style={{ marginLeft: 8 }}>
						Buscando...
					</Typography>
				</div>
			);
		}

		if (searchResults.length === 0 && searchTerm.length >= 2) {
			return (
				<div className={classes.emptySearchState}>
					<Typography variant="caption">
						Nenhuma mensagem encontrada
					</Typography>
				</div>
			);
		}

		return (
			<div className={classes.searchResults}>
				{searchResults.map((message, index) => (
					<div 
						key={message.id} 
						className={classes.searchResultItem}
						onClick={() => handleGoToMessage(message)}
					>
						<Typography 
							className={classes.searchResultText}
							dangerouslySetInnerHTML={{
								__html: highlightSearchTerm(message.body.substring(0, 100) + (message.body.length > 100 ? "..." : ""))
							}}
						/>
						<Typography className={classes.searchResultDate}>
							{new Date(message.createdAt).toLocaleString('pt-BR')} 
							{message.fromMe ? " (Você)" : ` (${contact.name})`}
						</Typography>
					</div>
				))}
			</div>
		);
	};

	const renderMediaContent = () => {
		if (loadingMedia) {
			return (
				<div className={classes.loadingContainer}>
					<CircularProgress />
				</div>
			);
		}

		const renderMediaGrid = (items, type) => {
			if (items.length === 0) {
				return (
					<div className={classes.emptyState}>
						<Typography variant="body2">
							{type === "images" && "Nenhuma imagem encontrada"}
							{type === "videos" && "Nenhum vídeo encontrado"}
							{type === "audios" && "Nenhum áudio encontrado"}
						</Typography>
					</div>
				);
			}

			return (
				<Grid container spacing={1} className={classes.mediaGrid}>
					{items.map((item, index) => (
						<Grid item xs={4} key={index}>
							<Paper 
								className={classes.mediaItem} 
								elevation={1}
								onClick={() => {
									if (type === "images" || type === "videos" || type === "audios") {
										window.open(item.mediaUrl, '_blank');
									}
								}}
							>
								{type === "images" && (
									<img 
										src={item.mediaUrl} 
										alt="" 
										className={classes.mediaThumbnail}
									/>
								)}
								{type === "videos" && (
									<Box display="flex" flexDirection="column" alignItems="center">
										<VideocamIcon className={classes.mediaIcon} />
										<Typography variant="caption" style={{ marginTop: 4 }}>
											{new Date(item.createdAt).toLocaleDateString('pt-BR')}
										</Typography>
									</Box>
								)}
								{type === "audios" && (
									<Box display="flex" flexDirection="column" alignItems="center">
										<AudiotrackIcon className={classes.mediaIcon} />
										<Typography variant="caption" style={{ marginTop: 4 }}>
											{new Date(item.createdAt).toLocaleDateString('pt-BR')}
										</Typography>
									</Box>
								)}
							</Paper>
						</Grid>
					))}
				</Grid>
			);
		};

		const renderDocuments = () => {
			if (mediaData.documents.length === 0) {
				return (
					<div className={classes.emptyState}>
						<Typography variant="body2">Nenhum documento encontrado</Typography>
					</div>
				);
			}

			return (
				<List>
					{mediaData.documents.map((doc, index) => (
						<ListItem 
							key={index} 
							button 
							className={classes.linkItem}
							onClick={() => window.open(doc.mediaUrl, '_blank')}
						>
							<ListItemIcon>
								<InsertDriveFileIcon />
							</ListItemIcon>
							<ListItemText 
								primary={doc.body || `Documento ${index + 1}`} 
								secondary={new Date(doc.createdAt).toLocaleDateString('pt-BR')}
							/>
						</ListItem>
					))}
				</List>
			);
		};

		const renderLinks = () => {
			if (mediaData.links.length === 0) {
				return (
					<div className={classes.emptyState}>
						<Typography variant="body2">Nenhum link encontrado</Typography>
					</div>
				);
			}

			return (
				<List>
					{mediaData.links.map((link, index) => (
						<ListItem 
							key={index} 
							button 
							className={classes.linkItem}
							onClick={() => window.open(link.url, '_blank')}
						>
							<ListItemIcon>
								<LinkIcon />
							</ListItemIcon>
							<ListItemText 
								primary={link.title || link.url} 
								secondary={new Date(link.createdAt).toLocaleDateString('pt-BR')}
							/>
						</ListItem>
					))}
				</List>
			);
		};

		return (
			<>
				<TabPanel value={tabValue} index={1} classes={classes}>
					{renderMediaGrid(mediaData.images, "images")}
				</TabPanel>
				<TabPanel value={tabValue} index={2} classes={classes}>
					{renderMediaGrid(mediaData.videos, "videos")}
				</TabPanel>
				<TabPanel value={tabValue} index={3} classes={classes}>
					{renderMediaGrid(mediaData.audios, "audios")}
				</TabPanel>
				<TabPanel value={tabValue} index={4} classes={classes}>
					{renderDocuments()}
				</TabPanel>
				<TabPanel value={tabValue} index={5} classes={classes}>
					{renderLinks()}
				</TabPanel>

				{contact.isGroup && (
	<TabPanel value={tabValue} index={contact.isGroup ? 5 : 4} classes={classes}>
		<Typography variant="h6" style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
			<GroupIcon style={{ marginRight: 8 }} />
			Participantes do Grupo ({participants.length})
		</Typography>
		{renderParticipants()}
	</TabPanel>
)}

			</>
		);
	};

	if (loading) return null;

	return (
		<>
			{/* Persistente en escritorio, donde es una columna mas; temporal en
			    pantallas estrechas, donde se superpone al chat y se cierra al
			    tocar fuera. El contenedor del modal ya apunta al area del
			    ticket, asi que el velo no tapa la aplicacion entera. */}
			<Drawer
				// Los 320px de classes.drawer solo tienen sentido en la variante
				// acoplada, donde reservan sitio en el flujo. En la temporal esa
				// clase cae sobre la RAIZ del modal y la encoge a 320: el velo
				// tapaba solo la anchura del panel y el panel se posicionaba
				// contra esa caja, no contra el area del ticket.
				className={
					superpuesto
						? undefined
						: clsx(classes.drawer, { [classes.drawerPlegado]: plegado })
				}
				variant={superpuesto ? "temporary" : "persistent"}
				anchor="right"
				// Acoplada, la columna no se cierra nunca: plegada se queda como riel.
				open={superpuesto ? open : true}
				onClose={handleDrawerClose}
				PaperProps={{ style: { position: "absolute" } }}
				BackdropProps={{ style: { position: "absolute" } }}
				ModalProps={{
					container: document.getElementById("drawer-container"),
					// Con position absolute y los desplazamientos en auto, la raiz
					// del modal se queda del ancho de su contenido —los 320 del
					// panel— y pegada al borde izquierdo. El panel se posiciona
					// contra ELLA, no contra el area del ticket, y acababa saliendo
					// a la izquierda. Con los cuatro lados a 0 ocupa el area entera
					// y el panel cae donde debe.
					style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
				}}
				classes={{
					paper: clsx(classes.drawerPaper, {
						[classes.drawerPaperSuperpuesto]: superpuesto,
						[classes.drawerPaperPlegado]: plegado,
					}),
				}}
			>
				{plegado && (
					<div className={classes.riel}>
						<Tooltip title={i18n.t("ticketOptionsMenu.contactInfo.show")} placement="left">
							<IconButton
								onClick={handleDrawerOpen}
								aria-label={i18n.t("ticketOptionsMenu.contactInfo.show")}
							>
								<ChevronLeftIcon />
							</IconButton>
						</Tooltip>
						{/* ContactAvatar es un componente de funcion sin forwardRef: el
						    Tooltip necesita un elemento que admita ref, asi que va en un span. */}
						<Tooltip title={contact.name || ""} placement="left">
							<span style={{ display: "inline-flex" }}>
								<ContactAvatar
									contact={contact}
									size={36}
									className={classes.rielAvatar}
									onClick={handleDrawerOpen}
								/>
							</span>
						</Tooltip>
					</div>
				)}

				<div className={clsx(classes.header, { [classes.ocultoPlegado]: plegado })}>
					{/* Acoplada, la ficha se pliega a su riel: flecha en vez de X. */}
					<IconButton
						onClick={handleDrawerClose}
						aria-label={i18n.t("ticketOptionsMenu.contactInfo.hide")}
					>
						{superpuesto ? <CloseIcon /> : <ChevronRightIcon />}
					</IconButton>
					<Typography style={{ justifySelf: "center" }}>
						{i18n.t("contactDrawer.header")}
					</Typography>
				</div>

				<div className={clsx(classes.contentWrapper, { [classes.ocultoPlegado]: plegado })}>
					{/* Seção de Switch */}
					<Box className={classes.switchContainer}>
						<Typography
							style={{ marginBottom: 0 }}
							variant="subtitle2"
						>
							<Switch
								size="small"
								checked={acceptAudioMessage}
								onChange={() => handleContactToggleAcceptAudio()}
								name="disableBot"
								color="primary"
							/>
							{i18n.t("ticketOptionsMenu.acceptAudioMessage")}								
						</Typography>
					</Box>

					{/* Seção do Perfil */}
					<div className={classes.profileSection}>
						<Paper square variant="outlined" className={classes.contactHeader}>
							{/* Avatar redondo e menor - CLICÁVEL */}
							{/* Mismo tratamiento que en la lista de conversaciones: sin
							    foto, circulo de color con las iniciales, y el color es
							    siempre el mismo para el mismo contacto. Antes era una
							    sola letra sobre el gris de serie de MUI.

							    El tamano va explicito —80, el que ya tenia la clase—
							    porque el estilo en linea del componente gana a la
							    clase y si no lo encogeria. */}
							<ContactAvatar
								contact={contact}
								size={80}
								className={classes.contactAvatar}
								onClick={handleImageClick}
							/>
							
							<CardHeader
								className={classes.contactCardHeader}
								onClick={() => { }}
								style={{ cursor: "pointer" }}
								titleTypographyProps={{ noWrap: true, align: "center" }}
								subheaderTypographyProps={{ noWrap: true, align: "center" }}
								title={
									<Typography variant="h6" align="center">
										{contact.name}
									</Typography>
								}
								subheader={
									<>
										<Typography style={{ fontSize: 12 }} align="center">
											{hideNum && user.profile === "user" ? formatSerializedId(contact.number).slice(0, -6) + "**-**" + contact.number.slice(-2) : formatSerializedId(contact.number)}
										</Typography>
										<Typography style={{ color: "primary", fontSize: 12 }} align="center">
											<Link href={`mailto:${contact.email}`}>{contact.email}</Link>
										</Typography>
									</>
								}
							/>
							
							{/* Canal y estado del ticket: dos datos que ya existian y que
							    solo se veian en la lista de conversaciones. */}
							{(canal || estado) && (
								<div className={classes.statusRow}>
									{canal && (
										<span className={classes.statusPill}>
											<span className={`${classes.statusDot} ${canal.punto}`} />
											{canal.etiqueta}
										</span>
									)}
									{estado && (
										<span className={classes.statusPill}>
											<span className={`${classes.statusDot} ${estado.punto}`} />
											{estado.etiqueta}
										</span>
									)}
								</div>
							)}

							{/* Acciones sobre el contacto.
							
							    Cada una lleva su etiqueta debajo del icono: antes eran iconos
							    sueltos y habia que esperar al tooltip para saber que hacian, que
							    en una pantalla tactil no aparece nunca. */}
							<div className={classes.contactActions}>
								<ButtonBase
									className={classes.actionCard}
									onClick={() => setSaleModalOpen(true)}
								>
									<MonetizationOnOutlinedIcon fontSize="small" />
									<span className={classes.actionCardLabel}>
										{i18n.t("contactDrawer.actions.sale")}
									</span>
								</ButtonBase>
								<ButtonBase
									className={classes.actionCard}
									onClick={() => setAppointmentModalOpen(true)}
								>
									<EventAvailableOutlinedIcon fontSize="small" />
									<span className={classes.actionCardLabel}>
										{i18n.t("contactDrawer.actions.appointment")}
									</span>
								</ButtonBase>
								<ButtonBase
									className={classes.actionCard}
									onClick={() => setModalOpen(!openForm)}
								>
									<CreateIcon fontSize="small" />
									<span className={classes.actionCardLabel}>
										{i18n.t("contactDrawer.actions.edit")}
									</span>
								</ButtonBase>
								<ButtonBase
									className={classes.actionCard}
									onClick={irANotas}
								>
									<MessageIcon fontSize="small" />
									<span className={classes.actionCardLabel}>
										{i18n.t("contactDrawer.actions.note")}
									</span>
								</ButtonBase>
								{ticket?.channel === "ghl" && (
									<ButtonBase
										className={classes.actionCard}
										onClick={() => setFlujoModalOpen(true)}
									>
										<AccountTree fontSize="small" />
										<span className={classes.actionCardLabel}>
											{i18n.t("contactDrawer.actions.workflow")}
										</span>
									</ButtonBase>
								)}
								<ButtonBase
									className={classes.actionCard}
									disabled={loading}
									onClick={() => contact.active
										? handleBlockContact(contact.id)
										: handleUnBlockContact(contact.id)}
								>
									{!contact.active
										? <LockOpenIcon fontSize="small" />
										: <BlockIcon fontSize="small" />}
									<span className={classes.actionCardLabel}>
										{i18n.t(contact.active
											? "contactDrawer.actions.block"
											: "contactDrawer.actions.unblock")}
									</span>
								</ButtonBase>
							</div>
							
							{(contact.id && openForm) && <ContactForm initialContact={contact} onCancel={() => setOpenForm(false)} />}
						</Paper>
					</div>

					{/* Campo de Pesquisa */}
					<Box className={classes.searchContainer}>
						<TextField
							className={classes.searchField}
							fullWidth
							size="small"
							variant="outlined"
							placeholder="Pesquisar nas mensagens..."
							value={searchTerm}
							onChange={handleSearchChange}
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" />
									</InputAdornment>
								),
								endAdornment: searchTerm && (
									<InputAdornment position="end">
										<IconButton
											size="small"
											onClick={clearSearch}
											edge="end"
										>
											<ClearIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								),
							}}
						/>
						
						{/* Resultados da Pesquisa */}
						<Collapse in={showSearchResults}>
							<Paper variant="outlined" style={{ marginTop: 8 }}>
								{renderSearchResults()}
							</Paper>
						</Collapse>
					</Box>

					{/* Abas com Ícones */}
					<Tabs
						value={tabValue}
						onChange={handleTabChange}
						variant="scrollable"
						scrollButtons="auto"
						className={classes.tabsContainer}
					>
						<Tab 
							className={classes.tabIcon}
							icon={<InfoIcon />}
							aria-label="Informações"
						/>
						<Tab 
							className={classes.tabIcon}
							icon={
								<Box display="flex" alignItems="center">
									<ImageIcon />
									{mediaData.images.length > 0 && (
										<Chip size="small" label={mediaData.images.length} className={classes.tabChip} />
									)}
								</Box>
							}
							aria-label="Imagens"
						/>
						<Tab 
							className={classes.tabIcon}
							icon={
								<Box display="flex" alignItems="center">
									<VideocamIcon />
									{mediaData.videos.length > 0 && (
										<Chip size="small" label={mediaData.videos.length} className={classes.tabChip} />
									)}
								</Box>
							}
							aria-label="Vídeos"
						/>
						<Tab 
							className={classes.tabIcon}
							icon={
								<Box display="flex" alignItems="center">
									<AudiotrackIcon />
									{mediaData.audios.length > 0 && (
										<Chip size="small" label={mediaData.audios.length} className={classes.tabChip} />
									)}
								</Box>
							}
							aria-label="Áudios"
						/>
						<Tab 
							className={classes.tabIcon}
							icon={
								<Box display="flex" alignItems="center">
									<InsertDriveFileIcon />
									{mediaData.documents.length > 0 && (
										<Chip size="small" label={mediaData.documents.length} className={classes.tabChip} />
									)}
								</Box>
							}
							aria-label="Documentos"
		

				/>
						<Tab 
							className={classes.tabIcon}
							icon={
								<Box display="flex" alignItems="center">
									<LinkIcon />
									{mediaData.links.length > 0 && (
										<Chip size="small" label={mediaData.links.length} className={classes.tabChip} />
									)}
								</Box>
							}
							aria-label="Links"
						/>
						{contact.isGroup && (
	<Tab 
		className={classes.tabIcon}
		icon={
			<Box display="flex" alignItems="center">
				<GroupIcon />
				{participants.length > 0 && (
					<Chip size="small" label={participants.length} className={classes.tabChip} />
				)}
			</Box>
		}
		aria-label="Participantes"
	/>
)}
					</Tabs>

					{/* Conteúdo Rolável */}
{/* Conteúdo Rolável */}
<div className={classes.scrollableContent}>
						{loading ? (
							<ContactDrawerSkeleton classes={classes} />
						) : (
							<>
								<TabPanel value={tabValue} index={0} classes={classes}>
									<TagsKanbanContainer ticket={ticket} className={classes.contactTags} />

									{/* Datos del ticket como pares etiqueta/valor alineados.
									    Todos salen de campos que el ticket ya devuelve; el
									    responsable enlaza con el modal de transferencia que ya
									    usan la lista y la barra de acciones. */}
									<Paper square variant="outlined" className={classes.infoBlock}>
										<div className={classes.infoTitle}>
											{i18n.t("contactDrawer.info.title")}
										</div>
										{telefonoVisible && (
											<div className={classes.infoRow}>
												<span className={classes.infoLabel}>
													{i18n.t("contactDrawer.info.phone")}
												</span>
												<span className={classes.infoValue}>{telefonoVisible}</span>
											</div>
										)}
										{canal && (
											<div className={classes.infoRow}>
												<span className={classes.infoLabel}>
													{i18n.t("contactDrawer.info.channel")}
												</span>
												<span className={classes.infoValue}>{canal.etiqueta}</span>
											</div>
										)}
										<div className={classes.infoRow}>
											<span className={classes.infoLabel}>
												{i18n.t("contactDrawer.info.owner")}
											</span>
											<span className={`${classes.infoValue} ${classes.infoValueRow}`}>
												{ticket?.user?.name || i18n.t("contactDrawer.info.unassigned")}
												<Button
													size="small"
													className={classes.infoAction}
													onClick={() => setTransferModalOpen(true)}
												>
													{i18n.t("contactDrawer.info.change")}
												</Button>
											</span>
										</div>
										{estado && (
											<div className={classes.infoRow}>
												<span className={classes.infoLabel}>
													{i18n.t("contactDrawer.info.status")}
												</span>
												<span className={classes.infoValue}>{estado.etiqueta}</span>
											</div>
										)}
										{ticket?.queue?.name && (
											<div className={classes.infoRow}>
												<span className={classes.infoLabel}>
													{i18n.t("contactDrawer.info.queue")}
												</span>
												<span className={classes.infoValue}>{ticket.queue.name}</span>
											</div>
										)}
										{fechaUltimoMensaje && (
											<div className={classes.infoRow}>
												<span className={classes.infoLabel}>
													{i18n.t("contactDrawer.info.lastMessage")}
												</span>
												<span className={classes.infoValue}>{fechaUltimoMensaje}</span>
											</div>
										)}
									</Paper>
									
									<Paper
										square
										variant="outlined"
										className={classes.contactDetails}
										ref={notasRef}
									>
										<Typography variant="subtitle1" style={{ marginBottom: 10 }}>
											{i18n.t("ticketOptionsMenu.appointmentsModal.title")}
										</Typography>
										<ContactNotes ticket={ticket} />
									</Paper>
									
									<Paper square variant="outlined" className={classes.contactDetails}>
										<ContactModal
											open={modalOpen}
											onClose={() => setModalOpen(false)}
											contactId={contact.id}
										></ContactModal>
										<SaleModal
											open={saleModalOpen}
											onClose={() => setSaleModalOpen(false)}
											contact={contact}
											ticket={ticket}
										/>
										<AppointmentModal
											open={appointmentModalOpen}
											onClose={() => setAppointmentModalOpen(false)}
											contact={contact}
											ticket={ticket}
										/>
										<GhlWorkflowModal
											open={flujoModalOpen}
											onClose={() => setFlujoModalOpen(false)}
											ticket={ticket}
										/>
										<TransferTicketModalCustom
											modalOpen={transferModalOpen}
											onClose={() => setTransferModalOpen(false)}
											ticketid={ticket?.id}
											ticket={ticket}
										/>
										<Typography variant="subtitle1">
											{i18n.t("contactDrawer.extraInfo")}
										</Typography>
										{contact?.extraInfo?.map(info => (
											<Paper
												key={info.id}
												square
												variant="outlined"
												className={classes.contactExtraInfo}
											>
												<InputLabel>{info.name}</InputLabel>
												<Typography component="div" noWrap style={{ paddingTop: 2 }}>
													<MarkdownWrapper>{info.value}</MarkdownWrapper>
												</Typography>
											</Paper>
										))}
									</Paper>
								</TabPanel>
								
								{/* TabPanels das Mídias */}
								<TabPanel value={tabValue} index={1} classes={classes}>
									{loadingMedia ? (
										<div className={classes.loadingContainer}>
											<CircularProgress />
										</div>
									) : (
										mediaData.images.length === 0 ? (
											<div className={classes.emptyState}>
												<Typography variant="body2">Nenhuma imagem encontrada</Typography>
											</div>
										) : (
											<Grid container spacing={1} className={classes.mediaGrid}>
												{mediaData.images.map((item, index) => (
													<Grid item xs={4} key={index}>
														<Paper 
															className={classes.mediaItem} 
															elevation={1}
															onClick={() => window.open(item.mediaUrl, '_blank')}
														>
															<img 
																src={item.mediaUrl} 
																alt="" 
																className={classes.mediaThumbnail}
															/>
														</Paper>
													</Grid>
												))}
											</Grid>
										)
									)}
								</TabPanel>

								<TabPanel value={tabValue} index={2} classes={classes}>
									{loadingMedia ? (
										<div className={classes.loadingContainer}>
											<CircularProgress />
										</div>
									) : (
										mediaData.videos.length === 0 ? (
											<div className={classes.emptyState}>
												<Typography variant="body2">Nenhum vídeo encontrado</Typography>
											</div>
										) : (
											<Grid container spacing={1} className={classes.mediaGrid}>
												{mediaData.videos.map((item, index) => (
													<Grid item xs={4} key={index}>
														<Paper 
															className={classes.mediaItem} 
															elevation={1}
															onClick={() => window.open(item.mediaUrl, '_blank')}
														>
															<Box display="flex" flexDirection="column" alignItems="center">
																<VideocamIcon className={classes.mediaIcon} />
																<Typography variant="caption" style={{ marginTop: 4 }}>
																	{new Date(item.createdAt).toLocaleDateString('pt-BR')}
																</Typography>
															</Box>
														</Paper>
													</Grid>
												))}
											</Grid>
										)
									)}
								</TabPanel>

								<TabPanel value={tabValue} index={3} classes={classes}>
									{loadingMedia ? (
										<div className={classes.loadingContainer}>
											<CircularProgress />
										</div>
									) : (
										mediaData.audios.length === 0 ? (
											<div className={classes.emptyState}>
												<Typography variant="body2">Nenhum áudio encontrado</Typography>
											</div>
										) : (
											<Grid container spacing={1} className={classes.mediaGrid}>
												{mediaData.audios.map((item, index) => (
													<Grid item xs={4} key={index}>
														<Paper 
															className={classes.mediaItem} 
															elevation={1}
															onClick={() => window.open(item.mediaUrl, '_blank')}
														>
															<Box display="flex" flexDirection="column" alignItems="center">
																<AudiotrackIcon className={classes.mediaIcon} />
																<Typography variant="caption" style={{ marginTop: 4 }}>
																	{new Date(item.createdAt).toLocaleDateString('pt-BR')}
																</Typography>
															</Box>
														</Paper>
													</Grid>
												))}
											</Grid>
										)
									)}
								</TabPanel>

								<TabPanel value={tabValue} index={4} classes={classes}>
									{loadingMedia ? (
										<div className={classes.loadingContainer}>
											<CircularProgress />
										</div>
									) : (
										mediaData.documents.length === 0 ? (
											<div className={classes.emptyState}>
												<Typography variant="body2">Nenhum documento encontrado</Typography>
											</div>
										) : (
											<List>
												{mediaData.documents.map((doc, index) => (
													<ListItem 
														key={index} 
														button 
														className={classes.linkItem}
														onClick={() => window.open(doc.mediaUrl, '_blank')}
													>
														<ListItemIcon>
															<InsertDriveFileIcon />
														</ListItemIcon>
														<ListItemText 
															primary={doc.body || `Documento ${index + 1}`} 
															secondary={new Date(doc.createdAt).toLocaleDateString('pt-BR')}
														/>
													</ListItem>
												))}
											</List>
										)
									)}
								</TabPanel>

								<TabPanel value={tabValue} index={5} classes={classes}>
									{loadingMedia ? (
										<div className={classes.loadingContainer}>
											<CircularProgress />
										</div>
									) : (
										mediaData.links.length === 0 ? (
											<div className={classes.emptyState}>
												<Typography variant="body2">Nenhum link encontrado</Typography>
											</div>
										) : (
											<List>
												{mediaData.links.map((link, index) => (
													<ListItem 
														key={index} 
														button 
														className={classes.linkItem}
														onClick={() => window.open(link.url, '_blank')}
													>
														<ListItemIcon>
															<LinkIcon />
														</ListItemIcon>
														<ListItemText 
															primary={link.title || link.url} 
															secondary={new Date(link.createdAt).toLocaleDateString('pt-BR')}
														/>
													</ListItem>
												))}
											</List>
										)
									)}
								</TabPanel>

								{/* TabPanel dos Participantes - ÍNDICE 6 */}
								{contact.isGroup && (
									<TabPanel value={tabValue} index={6} classes={classes}>
										<Typography variant="h6" style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
											<GroupIcon style={{ marginRight: 8 }} />
											Participantes do Grupo ({participants.length})
										</Typography>
										{renderParticipants()}
									</TabPanel>
								)}
							</>
						)}
					</div>
				</div>
			</Drawer>

			{/* Modal da Imagem */}
			<Dialog
				open={imageModalOpen}
				onClose={handleImageModalClose}
				className={classes.imageModal}
				maxWidth="md"
				fullWidth
			>
				<DialogContent className={classes.imageModalContent}>
					<img 
						src={contact?.urlPicture} 
						alt={contact?.name || "Foto do contato"}
						className={classes.expandedImage}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
};

export default ContactDrawer;