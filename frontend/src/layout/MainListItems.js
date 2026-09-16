import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import LinkIcon from "@material-ui/icons/Link";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountBalanceWalletIcon from "@material-ui/icons/AccountBalanceWallet";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import ViewKanban from "@mui/icons-material/ViewKanban";
import Schedule from "@material-ui/icons/Schedule";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PeopleIcon from "@material-ui/icons/People";
import ListIcon from "@material-ui/icons/ListAlt";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import ForumIcon from "@material-ui/icons/Forum";
import LocalAtmIcon from "@material-ui/icons/LocalAtm";
import BusinessIcon from "@material-ui/icons/Business";
import CakeIcon from "@material-ui/icons/Cake";
import MonetizationOnOutlinedIcon from "@material-ui/icons/MonetizationOnOutlined";
import {
  AllInclusive,
  AndroidOutlined,
  AttachFile,
  Dashboard,
  Description,
  DeviceHubOutlined,
  GridOn,
  PhonelinkSetup,
} from "@material-ui/icons";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";

import { Can, check } from "../components/Can";

import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import { i18n } from "../translate/i18n";
import { Campaign, ShapeLine, Webhook } from "@mui/icons-material";
import SupportAgent from "@mui/icons-material/SupportAgent";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";

import useCompanySettings from "../hooks/useSettings/companySettings";

const useStyles = makeStyles((theme) => ({
  // La navegacion vive sobre el bloque oscuro, asi que sus colores salen de
  // los tokens del sidebar y no del modo claro/oscuro general. Antes el texto
  // era "#666" en modo claro: sobre fondo oscuro habria quedado ilegible.
  listItem: {
    height: "44px",
    width: "auto",
    borderRadius: theme.palette.tokens.radius.md,
    marginBottom: 2,
    "&:hover": {
      // Velo tenue en vez de un cambio de color: no compite con el estado
      // activo. Sale de los tokens porque el menu sigue al modo claro/oscuro.
      backgroundColor: theme.palette.tokens.sidebar.hover,
    },
    "&:hover $iconHoverActive": {
      backgroundColor: theme.palette.tokens.sidebar.iconHover,
      color: theme.palette.tokens.sidebar.textActive,
    },
    "&:hover $listItemText": {
      color: theme.palette.tokens.sidebar.textActive,
    },
    transition: "background-color 180ms ease",
  },

  listItemText: {
    fontSize: "14px",
    color: theme.palette.tokens.sidebar.text,
    transition: "color 180ms ease",
    fontWeight: 500,
    "& .MuiTypography-root": {
      fontFamily: "'Inter', 'Roboto', sans-serif",
      fontSize: "0.875rem",
    },
  },

  // Titulos de los grupos del menu: medidos en el navegador, piden entre 127 y
  // 187px y la caja de texto del menu abierto mide 123. En una linea se
  // montaban sobre la flecha; pasan a dos lineas. Solo con el menu abierto:
  // plegado, el texto no se ve y partirlo alargaria la cabecera.
  grupoTitulo: {
    whiteSpace: "normal",
    lineHeight: 1.25,
  },

  avatarActive: {
    backgroundColor: "transparent",
  },

  avatarHover: {
    backgroundColor: "transparent",
  },

  iconHoverActive: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%", // Mantém circular original
    height: 36, // Mantém tamanho original
    width: 36,  // Mantém tamanho original
    backgroundColor: theme.palette.tokens.sidebar.iconBackground,
    color: theme.palette.tokens.sidebar.text,
    transition: "background-color 180ms ease, color 180ms ease",
    "&:hover, &.active": {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.tokens.brand.onPrimary,
      // Se retira la sombra de color: sobre fondo oscuro no se percibe y solo
      // emborrona el circulo.
    },
    "& .MuiSvgIcon-root": {
      fontSize: "1.4rem", // Mantém tamanho original
      transition: "transform 0.3s ease",
    },
    "&:hover .MuiSvgIcon-root": {
      transform: "none", // sin zoom: en una lista de 21 elementos, distrae
    }
  },

  // Badge melhorado mas mantendo funcionalidade
  badge: {
    "& .MuiBadge-badge": {
      backgroundColor: "#ef4444",
      color: "#fff",
      fontSize: "0.75rem",
      fontWeight: 600,
      animation: "$pulse 2s infinite",
    }
  },

  "@keyframes pulse": {
    "0%, 100%": {
      opacity: 1,
    },
    "50%": {
      opacity: 0.7,
    }
  },

  // Melhorias para submenus mantendo estrutura original
  submenuContainer: {
    backgroundColor: theme.mode === "light"
      ? "rgba(0, 0, 0, 0.02)"
      : "rgba(255, 255, 255, 0.02)",
  },

  // Tooltip melhorado
  customTooltip: {
    backgroundColor: theme.mode === "light" ? "#1e293b" : "#374151",
    color: "#fff",
    fontSize: "0.875rem",
    fontWeight: 500,
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    "& .MuiTooltip-arrow": {
      color: theme.mode === "light" ? "#1e293b" : "#374151",
    }
  },

  // Versão com destaque sutil
  versionContainer: {
    textAlign: "center",
    padding: "10px",
    color: theme.palette.primary.main, // Usa cor do tema
    fontSize: "12px",
    fontWeight: "bold",
    borderTop: `1px solid ${theme.mode === "light" ? "#f0f0f0" : "#333"}`,
    marginTop: "auto",
  },

  // Seções de administração com destaque sutil
  adminSection: {
    "& .MuiListSubheader-root": {
      color: theme.palette.primary.main, // Usa cor do tema
      fontSize: "0.875rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    }
  },

  // Efeitos suaves para expand/collapse
  expandIcon: {
    transition: "transform 0.3s ease",
    color: theme.palette.primary.main, // Usa cor do tema
    "&.expanded": {
      transform: "rotate(180deg)",
    }
  },

  // Menu container com melhorias sutis
  menuContainer: {
    overflowY: "auto",
    "&::-webkit-scrollbar": {
      width: "6px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      background: theme.mode === "light"
        ? "rgba(0, 0, 0, 0.1)"
        : "rgba(255, 255, 255, 0.1)",
      borderRadius: "3px",
      "&:hover": {
        background: theme.mode === "light"
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.2)",
      }
    },
  },

  // Estado ativo melhorado mantendo funcionalidade original
  activeItem: {
    "& $iconHoverActive": {
      backgroundColor: theme.palette.primary.main, // Usa cor do tema
      color: "#fff",
    },
    "& $listItemText": {
      color: theme.palette.primary.main, // Usa cor do tema
      fontWeight: 700,
    }
  }
}));

function ListItemLink(props) {
  const { icon, primary, to, tooltip, showBadge } = props;
  const classes = useStyles();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = activeMenu === to || location.pathname === to;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const ConditionalTooltip = ({ children, tooltipEnabled }) =>
    tooltipEnabled ? (
      <Tooltip title={primary} placement="right">
        {children}
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip}>
      <li>
        <ListItem button component={renderLink} className={classes.listItem}>
          {icon ? (
            <ListItemIcon>
              {showBadge ? (
                <Badge
                  badgeContent="!"
                  color="error"
                  overlap="circular"
                  className={classes.badge}
                >
                  <Avatar
                    className={`${classes.iconHoverActive} ${isActive ? "active" : ""
                      }`}
                  >
                    {icon}
                  </Avatar>
                </Badge>
              ) : (
                <Avatar
                  className={`${classes.iconHoverActive} ${isActive ? "active" : ""
                    }`}
                >
                  {icon}
                </Avatar>
              )}
            </ListItemIcon>
          ) : null}
          <ListItemText
            primary={
              <Typography className={classes.listItemText}>
                {primary}
              </Typography>
            }
          />
        </ListItem>
      </li>
    </ConditionalTooltip>
  );
}

// Grupo del menu lateral por rol. Es el mismo patron que ya tenian los
// submenus de Campanas y del Constructor de flujos —cabecera con icono y
// flecha, contenido en un Collapse—, sacado a un componente para no repetirlo
// en los tres grupos.
function GrupoMenu({ titulo, icono, abierto, onToggle, activo, collapsed, children }) {
  const classes = useStyles();
  const theme = useTheme();
  const [hover, setHover] = useState(false);

  return (
    <>
      <Tooltip title={collapsed ? titulo : ""} placement="right">
        <ListItem
          dense
          button
          onClick={onToggle}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <ListItemIcon>
            <Avatar
              className={`${classes.iconHoverActive} ${activo || hover ? "active" : ""}`}
            >
              {icono}
            </Avatar>
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography
                className={`${classes.listItemText} ${collapsed ? "" : classes.grupoTitulo}`}
              >
                {titulo}
              </Typography>
            }
          />
          {abierto ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </ListItem>
      </Tooltip>
      <Collapse
        in={abierto}
        timeout="auto"
        unmountOnExit
        style={{
          backgroundColor:
            theme.mode === "light"
              ? "rgba(120,120,120,0.1)"
              : "rgba(120,120,120,0.5)",
        }}
      >
        {children}
      </Collapse>
    </>
  );
}

// Rutas de cada grupo. Sirven para abrir el grupo que contiene la pagina
// actual (al cargar y al navegar desde fuera del menu), nunca para cerrarlo.
const RUTAS_DIARIO = ["/kanban", "/quick-messages", "/contacts", "/tags", "/schedules", "/chats", "/helps"];
const RUTAS_SUPERVISION = [
  "/", "/reports", "/sales", "/response-time", "/moments", "/wallets",
  "/campaigns", "/contact-lists", "/campaigns-config", "/files",
  "/phrase-lists", "/flowbuilders", "/prompts", "/ai-agents", "/queue-integration",
];
const RUTAS_ADMINISTRACION = [
  "/users", "/queues", "/connections", "/gohighlevel", "/allConnections",
  "/financeiro", "/settings", "/messages-api", "/announcements", "/companies",
];

const rutaEnGrupo = (pathname, rutas) =>
  rutas.some((ruta) =>
    ruta === "/" ? pathname === "/" : pathname === ruta || pathname.startsWith(`${ruta}/`)
  );

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    const chatIndex = state.findIndex((u) => u.id === chatId);
    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = ({ collapsed, drawerClose }) => {
  const theme = useTheme();
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket } = useContext(AuthContext);

  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openCampaignSubmenu, setOpenCampaignSubmenu] = useState(false);
  // Uso diario abierto por defecto; los otros dos cerrados, salvo que la
  // pagina con la que se entra sea suya.
  const [grupoDiarioAbierto, setGrupoDiarioAbierto] = useState(true);
  const [grupoSupervisionAbierto, setGrupoSupervisionAbierto] = useState(() =>
    rutaEnGrupo(location.pathname, RUTAS_SUPERVISION)
  );
  const [grupoAdministracionAbierto, setGrupoAdministracionAbierto] = useState(() =>
    rutaEnGrupo(location.pathname, RUTAS_ADMINISTRACION)
  );
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  // novas features
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const version = "4.7.9";
  const [campaignHover, setCampaignHover] = useState(false);
  const { list } = useHelps(); // INSERIR
  const [hasHelps, setHasHelps] = useState(false);

  const [openFlowSubmenu, setOpenFlowSubmenu] = useState(false);
  const [flowHover, setFlowHover] = useState(false);

  const { get: getSetting } = useCompanySettings();
  const [showWallets, setShowWallets] = useState(false);

  const isFlowbuilderRouteActive =
    location.pathname.startsWith("/phrase-lists");
  location.pathname.startsWith("/flowbuilders");

  useEffect(() => {
    // INSERIR ESSE EFFECT INTEIRO
    async function checkHelps() {
      try {
        const helps = await list();
        setHasHelps(helps.length > 0);
      } catch (err) {
        // Este efecto corre al montar el layout, que sigue montado unos
        // instantes despues de caducar la sesion. En ese hueco el servidor
        // responde 401 y, sin captura, la promesa quedaba rechazada sin
        // manejar: en desarrollo eso saca la pantalla roja de CRA.
        //
        // Un 401 aqui es esperado y no se avisa. El menu simplemente no
        // muestra la ayuda, que es el comportamiento correcto para quien
        // no tiene sesion. Cualquier otro error si se reporta.
        if (err?.response?.status !== 401) toastError(err);
      }
    }
    checkHelps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const setting = await getSetting(
          {
            "column": "DirectTicketsToWallets"
          }
        );

        setShowWallets(setting.DirectTicketsToWallets);

      } catch (err) {
        toastError(err);
      }
    }

    fetchSettings();
  }, [setShowWallets]);

  const isCampaignRouteActive =
    location.pathname === "/campaigns" ||
    location.pathname.startsWith("/contact-lists") ||
    location.pathname.startsWith("/campaigns-config");

  // Al entrar o navegar a una pagina de un grupo cerrado, se abre ese grupo
  // (y su submenu, si la pagina esta dentro de Campanas o de flujos) para que
  // se vea el item activo. Nunca se cierra nada por navegar.
  useEffect(() => {
    const ruta = location.pathname;
    if (rutaEnGrupo(ruta, RUTAS_DIARIO)) setGrupoDiarioAbierto(true);
    if (rutaEnGrupo(ruta, RUTAS_SUPERVISION)) setGrupoSupervisionAbierto(true);
    if (rutaEnGrupo(ruta, RUTAS_ADMINISTRACION)) setGrupoAdministracionAbierto(true);
    if (rutaEnGrupo(ruta, ["/campaigns", "/contact-lists", "/campaigns-config", "/files"])) {
      setOpenCampaignSubmenu(true);
    }
    if (rutaEnGrupo(ruta, ["/phrase-lists", "/flowbuilders"])) setOpenFlowSubmenu(true);
  }, [location.pathname]);

  // Roles efectivos: son las mismas expresiones que ya llevaban los <Can> del
  // menu, escritas una vez para usarlas en el JSX y para saber si el grupo de
  // supervision tiene algo que mostrar.
  const rolGestion =
    (user.profile === "user" && user.showDashboard === "enabled") ||
      user.allowRealTime === "enabled"
      ? "admin"
      : user.profile;
  const rolDashboard =
    user.profile === "user" && user.showDashboard === "enabled"
      ? "admin"
      : user.profile;
  const rolTiempoReal =
    user.profile === "user" && user.allowRealTime === "enabled"
      ? "admin"
      : user.profile;
  const rolAdministracion =
    user.profile === "user" && user.allowConnections === "enabled"
      ? "admin"
      : user.profile;

  // Un asesor sin dashboard, campanas ni flujos no ve un grupo vacio. Cada
  // termino repite la condicion con la que se pinta ese bloque mas abajo.
  const hayGestion =
    check(rolGestion, "drawer-admin-items:view") &&
    (check(rolDashboard, "drawer-admin-items:view") ||
      check(rolTiempoReal, "drawer-admin-items:view") ||
      (user.profile === "admin" && showWallets));
  const hayCampanas = user?.showCampaign === "enabled" && showCampaigns;
  const hayFlujos = user.showFlow === "enabled";
  const hayIaIntegraciones =
    check(rolAdministracion, "dashboard:view") &&
    (showOpenAi || showIntegrations) &&
    check(user.profile, "dashboard:view");
  const mostrarSupervision = hayGestion || hayCampanas || hayFlujos || hayIaIntegraciones;

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  const { getPlanCompany } = usePlans();

  

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      try {
        const companyId = user.companyId;
        const planConfigs = await getPlanCompany(undefined, companyId);

        setShowCampaigns(planConfigs.plan.useCampaigns);
        setShowKanban(planConfigs.plan.useKanban);
        setShowOpenAi(planConfigs.plan.useOpenAi);
        setShowIntegrations(planConfigs.plan.useIntegrations);
        setShowSchedules(planConfigs.plan.useSchedules);
        setShowInternalChat(planConfigs.plan.useInternalChat);
        setShowExternalApi(planConfigs.plan.useExternalApi);
      } catch (err) {
        // Mismo caso que checkHelps: con la sesion caducada esto respondia
        // 401 sin captura. Los apartados del menu se quedan ocultos, que es
        // lo correcto mientras no se sepa que plan tiene la empresa.
        if (err?.response?.status !== 401) toastError(err);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

useEffect(() => {
  if (user.id && socket && typeof socket.on === 'function') {
    const companyId = user.companyId;
    
    const onCompanyChatMainListItems = (data) => {
      if (data.action === "new-message") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
      if (data.action === "update") {
        dispatch({ type: "CHANGE_CHAT", payload: data });
      }
    };

    const eventName = `company-${companyId}-chat`;
    console.log('Registrando listener para:', eventName);
    
    socket.on(eventName, onCompanyChatMainListItems);
    
    return () => {
      if (socket && typeof socket.off === 'function') {
        console.log('Removendo listener para:', eventName);
        socket.off(eventName, onCompanyChatMainListItems);
      }
    };
  }
}, [socket, user.id, user.companyId]);

  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  // useEffect(() => {
  //   if (localStorage.getItem("cshow")) {
  //     setShowCampaigns(true);
  //   }
  // }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div onClick={drawerClose}>
      {/* La bandeja va fija arriba, fuera de los grupos: es lo que mas se usa. */}
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        tooltip={collapsed}
      />

      {/* Uso diario (asesor) */}
      <GrupoMenu
        titulo={i18n.t("mainDrawer.groups.daily")}
        icono={<SupportAgent />}
        abierto={grupoDiarioAbierto}
        onToggle={() => setGrupoDiarioAbierto((prev) => !prev)}
        activo={rutaEnGrupo(location.pathname, RUTAS_DIARIO)}
        collapsed={collapsed}
      >
        {showKanban && (
          <>
            <ListItemLink
              to="/kanban"
              primary={i18n.t("mainDrawer.listItems.kanban")}
              icon={<ViewKanban />}
              tooltip={collapsed}
            />
          </>
        )}

        <ListItemLink
          to="/quick-messages"
          primary={i18n.t("mainDrawer.listItems.quickMessages")}
          icon={<FlashOnIcon />}
          tooltip={collapsed}
        />

        {user.showContacts === "enabled" && (
          <ListItemLink
            to="/contacts"
            primary={i18n.t("mainDrawer.listItems.contacts")}
            icon={<ContactPhoneOutlinedIcon />}
            tooltip={collapsed}
          />
        )}

        <ListItemLink
          to="/tags"
          primary={i18n.t("mainDrawer.listItems.tags")}
          icon={<LocalOfferIcon />}
          tooltip={collapsed}
        />

        {showSchedules && (
          <>
            <ListItemLink
              to="/schedules"
              primary={i18n.t("mainDrawer.listItems.schedules")}
              icon={<Schedule />}
              tooltip={collapsed}
            />
          </>
        )}

        {showInternalChat && (
          <>
            <ListItemLink
              to="/chats"
              primary={i18n.t("mainDrawer.listItems.chats")}
              icon={
                <Badge color="secondary" variant="dot" invisible={invisible}>
                  <ForumIcon />
                </Badge>
              }
              tooltip={collapsed}
            />
          </>
        )}

        {/*
        <ListItemLink
          to="/todolist"
          primary={i18n.t("ToDoList")}
          icon={<EventAvailableIcon />}
        />
        */}

        {hasHelps && (
          <ListItemLink
            to="/helps"
            primary={i18n.t("mainDrawer.listItems.helps")}
            icon={<HelpOutlineIcon />}
            tooltip={collapsed}
          />
        )}
      </GrupoMenu>

      {/* Supervision y crecimiento: el antiguo submenu "Gestion", Campanas,
          Constructor de flujos, Prompts IA e Integracion de colas. Cada bloque
          conserva su condicion y sus <Can> tal cual. */}
      {mostrarSupervision && (
        <GrupoMenu
          titulo={i18n.t("mainDrawer.groups.supervision")}
          icono={<Dashboard />}
          abierto={grupoSupervisionAbierto}
          onToggle={() => setGrupoSupervisionAbierto((prev) => !prev)}
          activo={rutaEnGrupo(location.pathname, RUTAS_SUPERVISION)}
          collapsed={collapsed}
        >
          <Can
            role={rolGestion}
            perform={"drawer-admin-items:view"}
            yes={() => (
              <>
                <Can
                  role={rolDashboard}
                  perform={"drawer-admin-items:view"}
                  yes={() => (
                    <>
                      <ListItemLink
                        small
                        to="/"
                        primary="Dashboard"
                        icon={<DashboardOutlinedIcon />}
                        tooltip={collapsed}
                      />
                      <ListItemLink
                        small
                        to="/reports"
                        primary={i18n.t("mainDrawer.listItems.reports")}
                        icon={<Description />}
                        tooltip={collapsed}
                      />
                      <ListItemLink
                        small
                        to="/sales"
                        primary={i18n.t("sales.title")}
                        icon={<MonetizationOnOutlinedIcon />}
                        tooltip={collapsed}
                      />
                      <ListItemLink
                        small
                        to="/response-time"
                        primary={i18n.t("responseTime.title")}
                        icon={<Description />}
                        tooltip={collapsed}
                      />
                    </>
                  )}
                />
                <Can
                  role={rolTiempoReal}
                  perform={"drawer-admin-items:view"}
                  yes={() => (
                    <ListItemLink
                      to="/moments"
                      primary={i18n.t("mainDrawer.listItems.chatsTempoReal")}
                      icon={<GridOn />}
                      tooltip={collapsed}
                    />
                  )}
                />
                {user.profile === "admin" && showWallets && (
                  <>
                    <ListItemLink
                      to="/wallets"
                      primary={i18n.t("mainDrawer.listItems.wallets")}
                      icon={<AccountBalanceWalletIcon />}
                      tooltip={collapsed}
                    />
                  </>
                )}
              </>
            )}
          />

          {user?.showCampaign === "enabled" && showCampaigns && (
            <>
              <Tooltip
                title={collapsed ? i18n.t("mainDrawer.listItems.campaigns") : ""}
                placement="right"
              >
                <ListItem
                  dense
                  button
                  onClick={() => setOpenCampaignSubmenu((prev) => !prev)}
                  onMouseEnter={() => setCampaignHover(true)}
                  onMouseLeave={() => setCampaignHover(false)}
                >
                  <ListItemIcon>
                    <Avatar
                      className={`${classes.iconHoverActive} ${isCampaignRouteActive || campaignHover ? "active" : ""}`}
                    >
                      <EventAvailableIcon />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography className={classes.listItemText}>
                        {i18n.t("mainDrawer.listItems.campaigns")}
                      </Typography>
                    }
                  />
                  {openCampaignSubmenu ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItem>
              </Tooltip>
              <Collapse
                in={openCampaignSubmenu}
                timeout="auto"
                unmountOnExit
                style={{
                  backgroundColor:
                    theme.mode === "light"
                      ? "rgba(120,120,120,0.1)"
                      : "rgba(120,120,120,0.5)",
                }}
              >
                <List dense component="div" disablePadding>
                  <ListItemLink
                    to="/campaigns"
                    primary={i18n.t("campaigns.subMenus.list")}
                    icon={<ListIcon />}
                    tooltip={collapsed}
                  />
                  <ListItemLink
                    to="/contact-lists"
                    primary={i18n.t("campaigns.subMenus.listContacts")}
                    icon={<PeopleIcon />}
                    tooltip={collapsed}
                  />
                  <ListItemLink
                    to="/campaigns-config"
                    primary={i18n.t("campaigns.subMenus.settings")}
                    icon={<SettingsOutlinedIcon />}
                    tooltip={collapsed}
                  />
                  <Can
                    role={user.profile}
                    perform="dashboard:view"
                    yes={() => (
                      <ListItemLink
                        to="/files"
                        primary={i18n.t("mainDrawer.listItems.files")}
                        icon={<AttachFile />}
                        tooltip={collapsed}
                      />
                    )}
                  />
                </List>
              </Collapse>
            </>
          )}

          {/* FLOWBUILDER */}
          {user.showFlow === "enabled" && (
            <>
              <Tooltip
                title={
                  collapsed ? i18n.t("mainDrawer.listItems.campaigns") : ""
                }
                placement="right"
              >
                <ListItem
                  dense
                  button
                  onClick={() => setOpenFlowSubmenu((prev) => !prev)}
                  onMouseEnter={() => setFlowHover(true)}
                  onMouseLeave={() => setFlowHover(false)}
                >
                  <ListItemIcon>
                    <Avatar
                      className={`${classes.iconHoverActive} ${isFlowbuilderRouteActive || flowHover
                        ? "active"
                        : ""
                        }`}
                    >
                      <Webhook />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography className={classes.listItemText}>
                        {i18n.t("mainDrawer.submenuLabels.flowbuilder")}
                      </Typography>
                    }
                  />
                  {openFlowSubmenu ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </ListItem>
              </Tooltip>

              <Collapse
                in={openFlowSubmenu}
                timeout="auto"
                unmountOnExit
                style={{
                  backgroundColor:
                    theme.mode === "light"
                      ? "rgba(120,120,120,0.1)"
                      : "rgba(120,120,120,0.5)",
                }}
              >
                <List dense component="div" disablePadding>
                  <ListItemLink
                    to="/phrase-lists"
                    primary={i18n.t("mainDrawer.submenuLabels.flowCampaign")}
                    icon={<EventAvailableIcon />}
                    tooltip={collapsed}
                  />

                  <ListItemLink
                    to="/flowbuilders"
                    primary={i18n.t("mainDrawer.submenuLabels.flowConversation")}
                    icon={<ShapeLine />}
                    tooltip={collapsed}
                  />
                </List>
              </Collapse>
            </>
          )}

          {/* Prompts IA e Integracion de colas estaban dentro del bloque de
              Administracion: se mueven con ese mismo <Can> exterior. */}
          <Can
            role={rolAdministracion}
            perform="dashboard:view"
            yes={() => (
              <>
                {showOpenAi && (
                  <Can
                    role={user.profile}
                    perform="dashboard:view"
                    yes={() => (
                      <ListItemLink
                        to="/prompts"
                        primary={i18n.t("mainDrawer.listItems.prompts")}
                        icon={<AllInclusive />}
                        tooltip={collapsed}
                      />
                    )}
                  />
                )}

                {/* Agentes IA: mismas condiciones que Prompts IA, porque es la
                    evolucion de lo mismo y depende del mismo plan. */}
                {showOpenAi && (
                  <Can
                    role={user.profile}
                    perform="dashboard:view"
                    yes={() => (
                      <ListItemLink
                        to="/ai-agents"
                        primary={i18n.t("mainDrawer.listItems.aiAgents")}
                        icon={<AndroidOutlined />}
                        tooltip={collapsed}
                      />
                    )}
                  />
                )}

                {showIntegrations && (
                  <Can
                    role={user.profile}
                    perform="dashboard:view"
                    yes={() => (
                      <ListItemLink
                        to="/queue-integration"
                        primary={i18n.t("mainDrawer.listItems.queueIntegration")}
                        icon={<DeviceHubOutlined />}
                        tooltip={collapsed}
                      />
                    )}
                  />
                )}
              </>
            )}
          />
        </GrupoMenu>
      )}

      {/* Administracion de la cuenta: la misma condicion que tenia la seccion
          "Administracion" (divisor y subtitulo), ahora como grupo. */}
      <Can
        role={rolAdministracion}
        perform="dashboard:view"
        yes={() => (
          <GrupoMenu
            titulo={i18n.t("mainDrawer.groups.administration")}
            icono={<AdminPanelSettingsOutlined />}
            abierto={grupoAdministracionAbierto}
            onToggle={() => setGrupoAdministracionAbierto((prev) => !prev)}
            activo={rutaEnGrupo(location.pathname, RUTAS_ADMINISTRACION)}
            collapsed={collapsed}
          >
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/users"
                  primary={i18n.t("mainDrawer.listItems.users")}
                  icon={<PeopleAltOutlinedIcon />}
                  tooltip={collapsed}
                />
              )}
            />

            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/queues"
                  primary={i18n.t("mainDrawer.listItems.queues")}
                  icon={<AccountTreeOutlinedIcon />}
                  tooltip={collapsed}
                />
              )}
            />

            <Can
              role={rolAdministracion}
              perform={"drawer-admin-items:view"}
              yes={() => (
                <>
                  <ListItemLink
                    to="/connections"
                    primary={i18n.t("mainDrawer.listItems.connections")}
                    icon={<SyncAltIcon />}
                    showBadge={connectionWarning}
                    tooltip={collapsed}
                  />
                  {/* Tenia el mismo SyncAltIcon que Conexiones y no se
                      distinguian: GoHighLevel es una integracion externa. */}
                  <ListItemLink
                    to="/gohighlevel"
                    primary={i18n.t("mainDrawer.listItems.goHighLevel")}
                    icon={<LinkIcon />}
                    tooltip={collapsed}
                  />
                </>
              )}
            />
            {user.super && (
              <ListItemLink
                to="/allConnections"
                primary={i18n.t("mainDrawer.listItems.allConnections")}
                icon={<PhonelinkSetup />}
                tooltip={collapsed}
              />
            )}
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/financeiro"
                  primary={i18n.t("mainDrawer.listItems.financeiro")}
                  icon={<LocalAtmIcon />}
                  tooltip={collapsed}
                />
              )}
            />
            <Can
              role={user.profile}
              perform="dashboard:view"
              yes={() => (
                <ListItemLink
                  to="/settings"
                  primary={i18n.t("mainDrawer.listItems.settings")}
                  icon={<SettingsOutlinedIcon />}
                  tooltip={collapsed}
                />
              )}
            />

            {showExternalApi && (
              <>
                <Can
                  role={user.profile}
                  perform="dashboard:view"
                  yes={() => (
                    <ListItemLink
                      to="/messages-api"
                      primary={i18n.t("mainDrawer.listItems.messagesAPI")}
                      icon={<CodeRoundedIcon />}
                      tooltip={collapsed}
                    />
                  )}
                />
              </>
            )}

            {user.super && (
              <ListItemLink
                to="/announcements"
                primary={i18n.t("mainDrawer.listItems.annoucements")}
                icon={<AnnouncementIcon />}
                tooltip={collapsed}
              />
            )}

            {user.super && (
              <ListItemLink
                to="/companies"
                primary={i18n.t("mainDrawer.listItems.companies")}
                icon={<BusinessIcon />}
                tooltip={collapsed}
              />
            )}
          </GrupoMenu>
        )}
      />
      {!collapsed && (
        <React.Fragment>
          <Divider />
          <Typography
            style={{
              fontSize: "12px",
              padding: "10px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {`${version}`}
          </Typography>
        </React.Fragment>
      )}
    </div>
  );
};

export default MainListItems;