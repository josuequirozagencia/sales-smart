import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from "react";
import clsx from "clsx";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  Button,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  Badge,
  withStyles,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import NotificationsIcon from "@material-ui/icons/Notifications";
import CachedIcon from "@material-ui/icons/Cached";
import api from "../services/api";
import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import ChatPopover from "../pages/Chat/ChatPopover";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { getBackendUrl } from "../config";
import useSettings from "../hooks/useSettings";
import VersionControl from "../components/VersionControl";
import useSocketListener from "../hooks/useSocketListener";
import { FaGlobe } from "react-icons/fa";
import LanguageSelector from "../components/LanguageSelector";
import logo from "../assets/logo.png";
import logoBlack from "../assets/logo-black.png";

const backendUrl = getBackendUrl();
const drawerWidth = 240;


const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: {
      height: "calc(100vh - 56px)",
    },
    backgroundColor: theme.palette.fancyBackground,
    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary.main, // Usa cor do tema
      border: `1px solid ${theme.palette.primary.main}40`,
      borderRadius: "8px",
      fontWeight: 600,
      textTransform: "none",
      transition: "all 0.3s ease",
      "&:hover": {
        backgroundColor: `${theme.palette.primary.main}10`,
        borderColor: theme.palette.primary.main,
        transform: "translateY(-1px)",
        boxShadow: `0 4px 12px ${theme.palette.primary.main}30`,
      },
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      // El violeta de relleno como TEXTO no contrasta en oscuro (2,50).
      color: theme.palette.tokens.brand.onSurface,
      fontWeight: 700,
    },
  },

  chip: {
    // Era literalmente background: "red".
    background: theme.palette.tokens.semantic.error.fill,
    color: theme.palette.tokens.onColor(
      theme.palette.tokens.semantic.error.fill
    ),
  },

  avatar: {
    width: "100%",
  },

  // Cabecera y barra lateral forman una sola pieza oscura alrededor del
  // contenido claro. Antes la cabecera era un bloque del color de marca a
  // plena saturacion, que es lo que daba el aspecto de plantilla antigua.
  //
  // Se eligio cromo oscuro y no cabecera clara por una razon concreta: hay
  // varios "color: white" escritos en linea en el JSX de esta barra, y
  // aclararla los dejaria invisibles. Asi el blanco sigue siendo correcto.
  toolbar: {
    paddingRight: 24,
    // A 320px los siete botones de accion median 48px cada uno: 336px de
    // controles en una pantalla de 320. El contenido se salia 186px.
    //
    // No se oculta ninguna accion. Se recorta el relleno de los botones y se
    // retira el saludo, que es decorativo y no una funcion.
    [theme.breakpoints.down("xs")]: {
      paddingRight: 4,
      paddingLeft: 4,
      "& .MuiIconButton-root": {
        padding: 6,
      },
      // El selector de idioma se queda solo con la bandera. Ocupaba 120px mas
      // 32 de margen: casi la mitad de una pantalla de 320. El control sigue
      // ahi y sigue desplegando, unicamente pierde la palabra "Español", que
      // la bandera ya comunica.
      "& .MuiFormControl-root": {
        margin: "0 2px",
        minWidth: 0,
      },
      "& .MuiSelect-root .MuiTypography-root": {
        display: "none",
      },
      // El avatar y su envoltorio, ajustados al mismo criterio.
      "& .MuiAvatar-root": {
        width: 28,
        height: 28,
      },
    },
    background: theme.palette.tokens.sidebar.background,
    color: theme.palette.tokens.sidebar.textActive,
    boxShadow: "none",
    borderBottom: `1px solid ${theme.palette.tokens.sidebar.border}`,
    transition: "background-color 180ms ease",
  },

  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    minHeight: "48px",
    [theme.breakpoints.down("sm")]: {
      height: "48px",
    },
    // Continua el bloque oscuro: si esta zona fuera clara, el logo quedaria
    // en una isla blanca entre la cabecera y la navegacion.
    backgroundColor: theme.palette.tokens.sidebar.background,
    borderBottom: `1px solid ${theme.palette.tokens.sidebar.border}`,
  },

  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },

  menuButtonHidden: {
    display: "none",
  },

  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
    fontWeight: 600,
    letterSpacing: "0.025em",
    // Se recorta antes de empujar a los botones fuera de la pantalla.
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    // Por debajo de 600px desaparece. Es un saludo —"Hola Admin, bienvenido
    // a Empresa 1"—, no un control: no se pierde ninguna funcion, y el
    // espacio que libera es lo que permite que quepan todas las acciones.
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
  },

  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: "hidden",
    overflowY: "hidden",
    // Fondo propio en vez de heredar el del Paper. Sin esto la navegacion
    // era del mismo color que el contenido y no se distinguia como pieza.
    backgroundColor: theme.palette.tokens.sidebar.background,
    color: theme.palette.tokens.sidebar.text,
    // Los colores fijos "#e0e0e0" y "#424242" salen del sistema de tokens.
    borderRight: `1px solid ${theme.palette.tokens.sidebar.border}`,
    // Sin sombra: el contraste de color ya separa las dos zonas, y una
    // sombra encima solo ensucia el borde.
    boxShadow: "none",

    // Encabezados de seccion de la navegacion.
    //
    // Heredaban text.secondary del tema, que esta calculado para fondos
    // claros: sobre este violeta daban 2.38 de contraste. Con el tono
    // atenuado del propio sidebar suben a 5.23.
    //
    // El tratamiento en versalitas es el que usan las referencias para
    // separar grupos sin que el rotulo compita con los elementos.
    "& .MuiListSubheader-root": {
      backgroundColor: "transparent",
      color: theme.palette.tokens.sidebar.textMuted,
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      lineHeight: "32px",
    },

    // Los separadores heredaban el divisor claro del tema y quedaban como
    // una linea blanca sobre el fondo oscuro.
    "& .MuiDivider-root": {
      backgroundColor: theme.palette.tokens.sidebar.border,
    },
  },

  drawerPaperClose: {
    overflowX: "hidden",
    overflowY: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
  },

  appBarSpacer: {
    minHeight: "48px",
  },

  content: {
    flex: 1,
    overflow: "auto",
    // El contenido tenia padding 0 y margen 0: todo pegado al borde de la
    // pantalla. Es lo que hacia que la interfaz se viera comprimida.
    //
    // Escala por tamano: en movil el espacio es caro y un padding de
    // escritorio se come el ancho util; en escritorio hace falta para que el
    // contenido no toque el borde.
    padding: theme.palette.tokens.space.xl, // 24px en escritorio
    backgroundColor: theme.palette.tokens.surface.background,
    [theme.breakpoints.down("md")]: {
      padding: theme.palette.tokens.space.lg, // 16px en tablet
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.palette.tokens.space.md, // 12px en movil
    },
  },

  container: {
    padding: 0,
    margin: 0,
    maxWidth: "none",
    width: "100%",
  },

  containerWithScroll: {
    flex: 1,
    overflowY: "scroll",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    borderRadius: "8px",
    border: "2px solid transparent",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "-ms-overflow-style": "none",
    "scrollbar-width": "none",
  },

  NotificationsPopOver: {
    // Mantém original
  },

  logo: {
    width: "100%",
    height: "45px",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "100%",
      maxWidth: 180,
    },
    logo: theme.logo,
    content:
      "url(" +
      (theme.mode === "light"
        ? theme.calculatedLogoLight()
        : theme.calculatedLogoDark()) +
      ")",
    transition: "all 0.3s ease", // Transição suave
    "&:hover": {
      transform: "scale(1.02)", // Pequeno zoom no hover
    },
  },

  hideLogo: {
    display: "none",
  },

  avatar2: {
    width: theme.spacing(4),
    height: theme.spacing(4),
    cursor: "pointer",
    borderRadius: "50%",
    border: "2px solid #ccc",
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "scale(1.05)",
      borderColor: theme.palette.primary.main, // Usa cor do tema
    },
  },

  updateDiv: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  // Botões da toolbar melhorados
  toolbarButton: {
    color: "rgba(255, 255, 255, 0.9)",
    borderRadius: "8px",
    padding: "8px",
    margin: "0 2px",
    transition: "all 0.3s ease",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },

  // Menu hambúrguer com animação sutil
  menuButton: {
    color: "white",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    "& .MuiSvgIcon-root": {
      transition: "transform 0.3s ease",
    },
    "&:hover .MuiSvgIcon-root": {
      transform: "rotate(90deg)",
    },
  },

  // Seletor de idioma melhorado
  languageSelector: {
    position: "relative",
    display: "inline-block",
    "& > button": {
      background: "rgba(255, 255, 255, 0.1)",
      border: "none",
      borderRadius: "8px",
      color: "rgba(255, 255, 255, 0.9)",
      fontSize: "18px",
      padding: "8px 12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    "& > div": {
      position: "absolute",
      top: "45px",
      left: "0",
      background: "#fff",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      borderRadius: "8px",
      padding: "8px",
      zIndex: 1000,
      minWidth: "120px",
      "& button": {
        background: "none",
        border: "none",
        color: "#374151",
        display: "block",
        width: "100%",
        padding: "8px 12px",
        textAlign: "left",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: 500,
        transition: "all 0.2s ease",
        "&:hover": {
          background: `${theme.palette.primary.main}10`, // Usa cor do tema
          color: theme.palette.primary.main, // Usa cor do tema
          transform: "none",
        },
      },
    },
  },

  // Badge animado
  animatedBadge: {
    "& .MuiBadge-badge": {
      animation: "$heartbeat 2s infinite",
    },
  },

  "@keyframes heartbeat": {
    "0%": { transform: "scale(1)" },
    "14%": { transform: "scale(1.1)" },
    "28%": { transform: "scale(1)" },
    "42%": { transform: "scale(1.1)" },
    "70%": { transform: "scale(1)" },
  },
}));

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "$ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}))(Badge);

const SmallAvatar = withStyles((theme) => ({
  root: {
    width: 22,
    height: 22,
    border: `2px solid ${theme.palette.background.paper}`,
  },
}))(Avatar);

const LoggedInLayout = ({ children, themeToggle }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, user, socket } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  // Recuerda de que lado del umbral estabamos, para cerrar la barra solo al
  // cruzarlo y no en cada evento de resize.
  const eraMovilRef = useRef(
    typeof window !== "undefined" ? window.innerWidth < 600 : false
  );

  const [showOptions, setShowOptions] = useState(false);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);

  const { dateToClient } = useDate();
  const [profileUrl, setProfileUrl] = useState(null);
const [updateInProgress, setUpdateInProgress] = useState(false);


  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mainListItems = useMemo(
    () => <MainListItems drawerOpen={drawerOpen} collapsed={!drawerOpen} />,
    [user, drawerOpen]
  );

  const settings = useSettings();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data } = await api.get("/announcements/for-company", {
          params: {
            status: true,
            pageNumber: "1"
          }
        });
  
        // Filtra apenas os informativos ativos e não expirados
        const activeAnnouncements = data.records.filter(announcement => {
          const isActive = announcement.status === true || announcement.status === "true";
          const isNotExpired = !announcement.expiresAt || new Date(announcement.expiresAt) > new Date();
          return isActive && isNotExpired;
        });
  
        setAnnouncements(activeAnnouncements);
        
        // Mostra o modal apenas se houver informativos ativos
        if (activeAnnouncements.length > 0) {
          setShowAnnouncementsModal(true);
        }
      } catch (err) {
        toastError(err);
      }
    };
  
    if (user?.id) {
      fetchAnnouncements();
    }
  }, [user?.id]);

  useEffect(() => {
    // if (localStorage.getItem("public-token") === null) {
    //   handleLogout()
    // }

    if (document.body.offsetWidth > 600) {
      if (user.defaultMenu === "closed") {
        setDrawerOpen(false);
      } else {
        setDrawerOpen(true);
      }
    }
    if (user.defaultTheme === "dark" && theme.mode === "light") {
      colorMode.toggleColorMode();
    }
  }, [user.defaultMenu, document.body.offsetWidth]);

  useEffect(() => {
    // Antes esto leia document.body.offsetWidth y dependia de [drawerOpen],
    // asi que la variante se decidia una sola vez y no volvia a evaluarse.
    // Al girar una tablet o redimensionar la ventana, la barra se quedaba en
    // el modo equivocado: en 320px seguia siendo permanente y ocupaba 240px,
    // tres cuartas partes de la pantalla.
    //
    // Se escucha el resize de forma explicita en lugar de apoyarse en el
    // useMediaQuery del archivo. Comprobado en el navegador: matchMedia
    // devuelve el valor correcto al redimensionar, pero el hook de MUI v4 no
    // propago el cambio a React y la barra se quedaba en el modo anterior.
    const evaluar = () => {
      const esMovil = window.innerWidth < 600;
      setDrawerVariant(esMovil ? "temporary" : "permanent");

      // Solo al CRUZAR el umbral hacia movil, no en cada evento: en un
      // telefono el teclado virtual dispara resize, y cerrar aqui sin
      // condicion cerraria el menu que el usuario acaba de abrir.
      if (esMovil && !eraMovilRef.current) {
        setDrawerOpen(false);
      }
      eraMovilRef.current = esMovil;
    };

    evaluar();
    window.addEventListener("resize", evaluar);
    return () => window.removeEventListener("resize", evaluar);
  }, []);

  useEffect(() => {
  const companyId = user?.companyId;
  
  if (companyId) {
    const buildProfileUrl = () => {
      const savedProfileImage = localStorage.getItem("profileImage");
      const currentProfileImage = savedProfileImage || user.profileImage;
      
      if (currentProfileImage) {
        return `${backendUrl}/public/company${companyId}/user/${currentProfileImage}`;
      }
      return `${backendUrl}/public/app/noimage.png`;
    };

    setProfileUrl(buildProfileUrl());
  }
}, [user?.companyId, user?.profileImage, backendUrl]);

// Callbacks dos eventos
const handleAuthEvent = useCallback((data) => {
  if (data.user.id === +user?.id) {
    toastError("Sua conta foi acessada em outro computador.");
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 1000);
  }
}, [user?.id]);

const handleUserUpdate = useCallback((data) => {
  if (data.action === "update" && data.user.id === +user?.id) {
    if (data.user.profileImage) {
      const newProfileUrl = `${backendUrl}/public/company${user?.companyId}/user/${data.user.profileImage}`;
      setProfileUrl(newProfileUrl);
      localStorage.setItem("profileImage", data.user.profileImage);
    }
  }
}, [user?.companyId, user?.id, backendUrl]);

// Registrar listeners
useSocketListener(socket, user, 'auth', handleAuthEvent);
useSocketListener(socket, user, 'user', handleUserUpdate);

// Status do usuário
useEffect(() => {
  if (socket?.emit && user?.companyId) {
    socket.emit("userStatus");
    
    const interval = setInterval(() => {
      socket?.emit && socket.emit("userStatus");
    }, 1000 * 60 * 5);

    return () => clearInterval(interval);
  }
}, [socket, user?.companyId]);

    const handleUpdateStart = () => {
    setUpdateInProgress(true);
  };

  const handleUpdateComplete = () => {
    setUpdateInProgress(false);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (document.body.offsetWidth < 600 || user.defaultMenu === "closed") {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  };

  const handleMenuItemClick = () => {
    const { innerWidth: width } = window;
    if (width <= 600) {
      setDrawerOpen(false);
    }
  };

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
    window.location.reload();
  };

  const LANGUAGE_OPTIONS = [
    { code: "pt-BR", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "ar", label: "عربي" },
  ];

  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);
  const { getAll } = useSettings();
  useEffect(() => {
    async function fetchSettings() {
      try {
        const settings = await getAll();
        const enabledLanguagesSetting = settings.find(
          (s) => s.key === "enabledLanguages"
        )?.value;
        let langs = ["pt-BR", "en"];
        try {
          if (enabledLanguagesSetting) {
            langs = JSON.parse(enabledLanguagesSetting);
          }
        } catch { }
        console.log(
          "Layout - enabledLanguages carregadas:",
          langs,
          "para companyId:",
          user?.companyId
        );
        setEnabledLanguages(langs);
      } catch (error) {
        console.log("Layout - erro ao carregar enabledLanguages:", error);
      }
    }
    fetchSettings();
  }, [user?.companyId]);

  const filteredLanguageOptions = LANGUAGE_OPTIONS.filter((lang) =>
    enabledLanguages.includes(lang.code)
  );

  // Define o logo do header da sidebar usando o valor já resolvido do tema
  const headerLogoSrc = theme.mode === "light"
    ? (theme.appLogoLight || logo)
    : (theme.appLogoDark || logoBlack);

    if (loading || updateInProgress) {
    return <BackdropLoading />;
  }

  return (
    <div className={clsx(classes.root, "logged-in-layout")}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
        // Sin onClose, un Drawer temporal de MUI no se cierra al pulsar el
        // fondo ni con Escape: quedaba tapando la pantalla sin salida.
        onClose={() => setDrawerOpen(false)}
      >
        <div className={classes.toolbarIcon}>
          <img
            src={headerLogoSrc}
            style={{
              display: drawerOpen ? "block" : "none",
              margin: "0 auto",
              height: "50px",
              width: "100%",
              maxWidth: 180,
              transition: "all 0.3s ease",
            }}
            alt="logo"
          />
          <IconButton
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={drawerOpen ? "Cerrar menu" : "Abrir menu"}
            // Heredaba el gris por defecto del MUI, que sobre el violeta
            // oscuro de la barra quedaba practicamente invisible: el boton
            // estaba ahi pero no se veia.
            style={{ color: theme.palette.tokens.sidebar.textActive }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <List className={classes.containerWithScroll}>
          {/* {mainListItems} */}
          <MainListItems collapsed={!drawerOpen} />
        </List>
        <Divider />
      </Drawer>

      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="primary"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            variant="contained"
            aria-label="open drawer"
            style={{ color: "white" }}
            onClick={() => setDrawerOpen(!drawerOpen)}
            // Solo se oculta en escritorio, donde la barra queda desplegada
            // y tiene su propio boton de cerrar a la vista. En movil debe
            // seguir accesible: era el caso en que el usuario se quedaba sin
            // forma de abrir el menu.
            className={clsx(
              drawerOpen && greaterThenSm && classes.menuButtonHidden
            )}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            component="h2"
            variant="h6"
            color="inherit"
            noWrap
            className={classes.title}
          >
            {/* {greaterThenSm && user?.profile === "admin" && getDateAndDifDays(user?.company?.dueDate).difData < 7 ? ( */}
            {greaterThenSm &&
              user?.profile === "admin" &&
              user?.company?.dueDate ? (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>! (
                {i18n.t("mainDrawer.appBar.user.active")}{" "}
                {dateToClient(user?.company?.dueDate)})
              </>
            ) : (
              <>
                {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                <b>{user?.company?.name}</b>!
              </>
            )}
          </Typography>

          <VersionControl 
            onUpdateStart={handleUpdateStart}
            onUpdateComplete={handleUpdateComplete}
          />

          <LanguageSelector variant="compact" />

          <IconButton edge="start" onClick={colorMode.toggleColorMode}>
            {theme.mode === "dark" ? (
              <Brightness7Icon style={{ color: "white" }} />
            ) : (
              <Brightness4Icon style={{ color: "white" }} />
            )}
          </IconButton>

          <NotificationsVolume setVolume={setVolume} volume={volume} />

          <IconButton
            onClick={handleRefreshPage}
            aria-label={i18n.t("mainDrawer.appBar.refresh")}
            color="inherit"
          >
            <CachedIcon style={{ color: "white" }} />
          </IconButton>

          {/* <DarkMode themeToggle={themeToggle} /> */}

          {user.id && <NotificationsPopOver volume={volume} />}

          <AnnouncementsPopover />

          <ChatPopover />

          <div className="user-menu-wrapper">
            <StyledBadge
              overlap="circular"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              variant="dot"
              onClick={handleMenu}
            >
              <Avatar
                alt="Multi100"
                className={classes.avatar2}
                src={profileUrl}
              />
            </StyledBadge>

            <UserModal
              open={userModalOpen}
              onClose={() => setUserModalOpen(false)}
              onImageUpdate={(newProfileUrl) => setProfileUrl(newProfileUrl)}
              userId={user?.id}
            />

            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
              PaperProps={{
                style: {
                  minWidth: "150px",
                  maxWidth: "200px",
                  width: "auto",
                },
              }}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        {children ? children : null}
      </main>

      {/* Modal de Informativos */}
      <Dialog
        open={showAnnouncementsModal}
        onClose={() => setShowAnnouncementsModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Informativos</DialogTitle>
        <DialogContent dividers>
          {selectedAnnouncement ? (
            <div>
              <Typography variant="h6" gutterBottom>
                {selectedAnnouncement.title}
              </Typography>
              <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                {selectedAnnouncement.text}
              </Typography>
              {selectedAnnouncement.mediaPath && (
                <div style={{ marginTop: 16 }}>
                  <img
                    src={`${backendUrl}/public/company${user.companyId}${selectedAnnouncement.mediaPath}`}
                    alt="Anexo"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              )}
              <Button
                onClick={() => setSelectedAnnouncement(null)}
                style={{ marginTop: 16 }}
                variant="outlined"
              >
                Voltar para lista
              </Button>
            </div>
          ) : (
            <List>
              {announcements.map((announcement) => (
                <ListItem
                  button
                  key={announcement.id}
                  onClick={() => setSelectedAnnouncement(announcement)}
                >
                  <ListItemAvatar>
                    <Avatar>
                      <NotificationsIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={announcement.title}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color="textPrimary"
                        >
                          Prioridade: {announcement.priority === 1 ? 'Alta' : announcement.priority === 2 ? 'Média' : 'Baixa'}
                        </Typography>
                        {` — ${new Date(announcement.createdAt).toLocaleDateString()}`}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowAnnouncementsModal(false)}
            color="primary"
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

    </div>
  );
};

export default LoggedInLayout;