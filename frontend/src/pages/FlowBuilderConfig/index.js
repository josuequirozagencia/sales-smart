import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback
} from "react";
import { SiOpenai } from "react-icons/si";
import { toast } from "react-toastify";
import "./mobile-styles.css";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Paper,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Chip,
  Grid,
  Collapse,
  useMediaQuery,
  Menu,
  MenuItem,
  Fab,
  Slide,
  ClickAwayListener,
  Tooltip,
  ButtonGroup
} from "@material-ui/core";
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Add as AddIcon,
  ExpandLess,
  ExpandMore,
  Save as SaveIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ChevronLeft,
  ChevronRight
} from "@material-ui/icons";
import WebAssetIcon from '@material-ui/icons/WebAsset';
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

import HttpIcon from "@mui/icons-material/Http";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import CompareArrows from "@mui/icons-material/CompareArrows";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow
} from "react-flow-renderer";

import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  Image,
  ImportExport,
  LibraryBooks,
  Message,
  MicNone,
  RocketLaunch,
  Videocam,
  Tag,
  Queue,
  Person
} from "@mui/icons-material";
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Import dos nós (mantendo os mesmos)
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import openaiNode from "./nodes/openaiNode";
import geminiNode from "./nodes/geminiNode";
//import conditionNode from "./nodes/conditionNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import switchFlowNode from "./nodes/switchFlowNode";
import attendantNode from "./nodes/attendantNode";
import RemoveEdge from "./nodes/removeEdge";
import audioNode from "./nodes/audioNode";
import { useNodeStorage } from "../../stores/useNodeStorage";
import singleBlockNode from "./nodes/singleBlockNode";
import ticketNode from "./nodes/ticketNode";
import tagNode from "./nodes/tagNode";
//import conditionCompareNode from "./nodes/conditionCompareNode";
import HttpRequestNode from "./nodes/httpRequestNode";
import removeTagNode from "./nodes/removeTagNode";
import VariableNode, {
  getFlowVariable,
  setFlowVariable,
} from "./nodes/variableNode";
import inputNode from "./nodes/inputNode";

// Imports dos modais (mantendo os mesmos)
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderAddTagModal from "../../components/FlowBuilderAddTagModal";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
//import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import FlowBuilderAddSwitchFlowModal from "../../components/FlowBuilderAddSwitchFlowModal";
import FlowBuilderAddAttendantModal from "../../components/FlowBuilderAddAttendantModal";
import FlowBuilderInputModal from "../../components/FlowBuilderInputModal";
//import FlowBuilderConditionCompareModal from "../../components/FlowBuilderConditionCompareModal";
import FlowBuilderRemoveTagModal from "../../components/FlowBuilderRemoveTagModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderGeminiModal from "../../components/FlowBuilderGeminiModal";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { CircularProgress } from "@material-ui/core";



const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default
  },
  header: {
    flexShrink: 0,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  content: {
    flex: 1,
    display: "flex",
    position: "relative",
    overflow: "hidden"
  },
  // Sidebar colapsável para desktop
  sidebar: {
    width: props => props.sidebarOpen ? 300 : 60,
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: "width 0.3s ease",
    display: "flex",
    flexDirection: "column",
    zIndex: 1000,
    [theme.breakpoints.down('md')]: {
      display: "none" // Ocultar sidebar em mobile
    }
  },
  sidebarHeader: {
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    backgroundColor: theme.palette.background.paper
  },
  sidebarContent: {
    flex: 1,
    overflowY: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles
  },
  flowContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: theme.palette.type === 'dark' ? '#121212' : '#F8F9FA',
    '& .react-flow__controls': {
      zIndex: 1100, // Garantir que fique acima de outros elementos
      bottom: theme.spacing(2),
      left: theme.spacing(2),
      [theme.breakpoints.down('md')]: {
        display: 'none' // Ocultar em mobile já que temos controles customizados
      }
    }
  },
  // Bottom sheet para mobile
  bottomSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.palette.background.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    boxShadow: theme.shadows[8],
    zIndex: 1500,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.up('lg')]: {
      display: "none" // Ocultar em desktop
    }
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.palette.divider,
    borderRadius: 2,
    margin: "8px auto",
    cursor: "pointer"
  },
  bottomSheetHeader: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.palette.background.paper
  },
  bottomSheetContent: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles
  },
  // Floating Action Button
  // La columna de arriba a la derecha: el boton de guardar y los accesos
  // rapidos, juntos.
  //
  // Antes eran dos elementos position:fixed independientes, cada uno con su
  // coordenada a mano —top 20 y top 80— y entre el borde del boton y el
  // primer acceso rapido quedaban unos 4px: se veian pegados y se pisaban.
  // Ahora el hueco lo calcula el gap de este contenedor, y si manana cambia
  // el tamano del boton no hay que recalcular nada.
  toolbarDock: {
    // Absoluta respecto al lienzo, no fija respecto al viewport: asi el
    // boton de guardar no se mete debajo de la barra superior.
    position: "absolute",
    top: theme.spacing(2),
    // Deja sitio a la barra de desplazamiento del lienzo, que cae a su
    // derecha y quedaba practicamente debajo de los botones.
    right: theme.spacing(3),
    zIndex: 1400,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(2)
  },
  // Solo mobile: ahi el guardar se queda abajo, al alcance del pulgar. En
  // desktop vive dentro de toolbarDock y no se posiciona por su cuenta.
  fab: {
    position: "fixed",
    bottom: theme.spacing(9),
    right: theme.spacing(2),
    zIndex: 1400,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    }
  },
  addFab: {
    position: "fixed",
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 1400,
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.secondary.dark,
    },
    [theme.breakpoints.up('lg')]: {
      display: "none" // Ocultar em desktop (usa sidebar)
    }
  },
  // Categorias de nós
  categoryButton: {
    margin: theme.spacing(0.5),
    textTransform: "none",
    borderRadius: theme.spacing(1),
    minWidth: "auto",
    fontSize: "0.75rem",
    color: theme.palette.text.primary,
    borderColor: theme.palette.divider
  },
  nodeButton: {
    justifyContent: "flex-start",
    textTransform: "none",
    padding: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.spacing(1),
    transition: "all 0.2s ease",
    color: theme.palette.text.primary,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      transform: "translateX(4px)"
    }
  },
  collapsedNodeButton: {
    width: 48,
    height: 48,
    minWidth: 48,
    padding: 0,
    margin: theme.spacing(0.5, 0.5),
    justifyContent: "center",
    color: theme.palette.text.primary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    }
  },
  categoryHeader: {
    padding: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    fontWeight: "bold",
    color: theme.palette.text.primary,
    cursor: "pointer",
    userSelect: "none",
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    }
  },
  // Ya no se posiciona sola: vive dentro de toolbarDock, que es quien la
  // ancla y quien pone la separacion respecto al boton de guardar.
  quickActions: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1)
  },
  quickActionButton: {
    backgroundColor: theme.palette.background.paper,
    backdropFilter: "blur(10px)",
    boxShadow: theme.shadows[3],
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      transform: "scale(1.05)",
      boxShadow: theme.shadows[6]
    }
  },
  // Mobile controls
  mobileControls: {
    position: "fixed",
    bottom: 80,
    left: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    zIndex: 1300,
    [theme.breakpoints.up('lg')]: {
      display: "none"
    }
  },
  controlButton: {
    backgroundColor: theme.palette.background.paper,
    backdropFilter: "blur(10px)",
    boxShadow: theme.shadows[3],
    width: 48,
    height: 48,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      transform: "scale(1.05)"
    }
  },
  categoryCard: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1)
  },
  categoryTitle: {
    fontWeight: "bold",
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: theme.palette.text.primary
  },
  categoryNodeBtn: {
    width: "100%",
    marginBottom: theme.spacing(0.5),
    justifyContent: "flex-start",
    textTransform: "none",
    fontSize: "0.8rem",
    padding: theme.spacing(1, 1.5),
    color: theme.palette.text.primary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    }
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "70vh",
    backgroundColor: theme.palette.background.paper
  }
}));

// Definição das categorias de nós
const nodeCategories = [
  {
    id: "basics",
    name: i18n.t("flows.basics"),
    color: theme => theme.palette.primary.main,
    icon: <RocketLaunch />,
    nodes: [
      {
        icon: <RocketLaunch />,
        name: i18n.t("flows.start"),
        type: "start",
        description: i18n.t("flows.startPoint")
      }
    ]
  },
  {
    id: "content",
    name: i18n.t("flows.content"),
    color: theme => theme.palette.success.main,
    icon: <LibraryBooks />,
    nodes: [
      {
        icon: <LibraryBooks />,
        name: i18n.t("flows.content"),
        type: "content",
        description: i18n.t("flows.nodeContentDesc")
      },
      {
        icon: <Message />,
        name: i18n.t("flows.nodeText"),
        type: "text",
        description: i18n.t("flows.nodeTextDesc")
      }
    ]
  },
  {
    id: "interaction",
    name: i18n.t("flows.interaction"),
    color: theme => theme.palette.warning.main,
    icon: <DynamicFeed />,
    nodes: [
      {
        icon: <DynamicFeed />,
        name: i18n.t("flows.nodeMenu"),
        type: "menu",
        description: i18n.t("flows.nodeMenuDesc")
      },
      {
        icon: <QuestionAnswerIcon />,
        name: i18n.t("flows.nodeInput"),
        type: "input",
        description: i18n.t("flows.nodeInputDesc")
      },
      {
        icon: <AccessTime />,
        name: i18n.t("flows.nodeInterval"),
        type: "interval",
        description: i18n.t("flows.nodeIntervalDesc")
      }
    ]
  },
  {
    id: "logic",
    name: i18n.t("flows.logic"),
    color: theme => theme.palette.secondary.main,
    icon: <CallSplit />,
    nodes: [
      {
        icon: <CallSplit />,
        name: i18n.t("flows.nodeRandom"),
        type: "random",
        description: i18n.t("flows.nodeRandomDesc")
      }
    ]
  },
  {
    id: "system",
    name: i18n.t("flows.system"),
    color: theme => theme.palette.info.main,
    icon: <Queue />,
    nodes: [
      {
        icon: <Queue />,
        name: i18n.t("flows.nodeQueues"),
        type: "ticket",
        description: i18n.t("flows.nodeQueuesDesc")
      },
      {
        icon: <Tag />,
        name: i18n.t("flows.nodeTags"),
        type: "tag",
        description: i18n.t("flows.nodeTagsDesc")
      },
      {
        icon: <Tag />,
        name: i18n.t("flows.nodeRemoveTag"),
        type: "removeTag",
        description: i18n.t("flows.nodeRemoveTagDesc")
      },
      {
        icon: <ArrowForwardIcon />,
        name: i18n.t("flows.nodeSwitchFlow"),
        type: "switchFlow",
        description: i18n.t("flows.nodeSwitchFlowDesc")
      },
      {
        icon: <Person />,
        name: i18n.t("flows.nodeAttendant"),
        type: "attendant",
        description: i18n.t("flows.nodeAttendantDesc")
      }
    ]
  },
  {
    id: "integrations",
    name: i18n.t("flows.integrations"),
    color: theme => theme.palette.error.main,
    icon: <HttpIcon />,
    nodes: [
      {
        icon: <HttpIcon />,
        name: i18n.t("flows.nodeHttp"),
        type: "httpRequest",
        description: i18n.t("flows.nodeHttpDesc")
      },
      {
        icon: <DataObjectIcon />,
        name: i18n.t("flows.nodeVariable"),
        type: "variable",
        description: i18n.t("flows.nodeVariableDesc")
      },
      {
        icon: <SiOpenai />,
        name: i18n.t("flows.nodeGemini"),
        type: "gemini",
        description: i18n.t("flows.nodeGeminiDesc")
      },
      {
        icon: <SiOpenai />,
        name: i18n.t("flows.nodeOpenai"),
        type: "openai",
        description: i18n.t("flows.nodeOpenaiDesc")
      }
    ]
  }
];

// Função para gerar string aleatória (mantida igual)
function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

// Tipos de nós (mantido igual)
const nodeTypes = {
  message: messageNode,
  start: startNode,
  //condition: conditionNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  gemini: geminiNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  tag: tagNode,
  removeTag: removeTagNode,
  switchFlow: switchFlowNode,
  attendant: attendantNode,
  httpRequest: HttpRequestNode,
  variable: VariableNode,
  openai: openaiNode,
  input: inputNode,
  //conditionCompare: conditionCompareNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: i18n.t("flows.flowStart") },
    type: "start"
  }
];

const initialEdges = [];

// Função para detectar se é mobile
const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || 
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0)
  );
};

// Componente de controles customizados para mobile
const MobileControls = () => {
  const classes = useStyles();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  return (
    <div className={classes.mobileControls}>
      <IconButton
        onClick={() => zoomIn()}
        className={classes.controlButton}
        size="small"
      >
        <ZoomInIcon />
      </IconButton>
      
      <IconButton
        onClick={() => zoomOut()}
        className={classes.controlButton}
        size="small"
      >
        <ZoomOutIcon />
      </IconButton>
      
      <IconButton
        onClick={() => fitView({ padding: 0.2 })}
        className={classes.controlButton}
        size="small"
      >
        <WebAssetIcon />
      </IconButton>
    </div>
  );
};

// Componente de ações rápidas para desktop
const QuickActions = ({ onActionClick }) => {
  const classes = useStyles();
  
  const quickActions = [
    { icon: <Message />, name: i18n.t("flows.nodeText"), type: "text" },
    { icon: <DynamicFeed />, name: i18n.t("flows.nodeMenu"), type: "menu" },
    { icon: <AccessTime />, name: i18n.t("flows.nodeInterval"), type: "interval" },
    { icon: <LibraryBooks />, name: i18n.t("flows.content"), type: "content" }
  ];
  
  return (
    <div className={classes.quickActions}>
      {quickActions.map((action) => (
        <Tooltip key={action.type} title={action.name} placement="left">
          <IconButton
            onClick={() => onActionClick(action.type)}
            className={classes.quickActionButton}
            size="medium"
          >
            {action.icon}
          </IconButton>
        </Tooltip>
      ))}
    </div>
  );
};

export const FlowBuilderConfig = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { id } = useParams();
  
  // Estados para interface
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(["basics"]);
  
  const classes = useStyles({ sidebarOpen });
  
  // Estados existentes (mantidos)
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Estados dos modais (mantidos)
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  //const [modalAddCondition, setModalAddCondition] = useState(null);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddSwitchFlow, setModalAddSwitchFlow] = useState(null);
  const [modalAddAttendant, setModalAddAttendant] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddGemini, setModalAddGemini] = useState(null);
  const [modalAddInput, setModalAddInput] = useState(null);
  //const [modalAddConditionCompare, setModalAddConditionCompare] = useState(null);
  const [modalAddRemoveTag, setModalAddRemoveTag] = useState(null);

  // Estados ReactFlow (mantidos)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const storageItems = useNodeStorage();

  const connectionLineStyle = { 
    stroke: theme.palette.primary.main, 
    strokeWidth: isMobileDevice() ? "8px" : "6px" 
  };

  const onConnect = useCallback(
    params => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  );

  // Inicializar sistema de variáveis globais
  useEffect(() => {
    if (!window.flowVariables) {
      window.flowVariables = {};
      console.log("Sistema de variáveis globais inicializado");
    }
    window.getFlowVariable = getFlowVariable;
    window.setFlowVariable = setFlowVariable;
  }, []);

  // Função addNode COMPLETA (mantida igual - muito longa para reproduzir aqui)
  const addNode = (type, data) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX = nodes[nodes.length - 1].position.x + (nodes[nodes.length - 1].width || 200) + 40;

    if (type === "start") {
      return setNodes(old => {
        return [
          ...old.filter(item => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: i18n.t("flows.flowStart") },
            type: "start"
          }
        ];
      });
    }
    
    if (type === "text") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message"
          }
        ];
      });
    }
    
    if (type === "interval") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval"
          }
        ];
      });
    }
    
    if (type === "menu") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption
            },
            type: "menu"
          }
        ];
      });
    }
    
    if (type === "img") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img"
          }
        ];
      });
    }
    
    if (type === "audio") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio"
          }
        ];
      });
    }
    
    if (type === "randomizer") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer"
          }
        ];
      });
    }
    
    if (type === "video") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video"
          }
        ];
      });
    }
    
    if (type === "singleBlock") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock"
          }
        ];
      });
    }
    
    if (type === "ticket") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket"
          }
        ];
      });
    }
    
    if (type === "openai") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }

    if (type === "gemini") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "gemini",
          },
        ];
      });
    }
    
    if (type === "tag") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "tag"
          }
        ];
      });
    }
    
    if (type === "removeTag") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              tag: data?.tag || "",
              ...data,
            },
            type: "removeTag",
          },
        ];
      });
    }
    
    if (type === "switchFlow") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "switchFlow"
          }
        ];
      });
    }
    
    if (type === "attendant") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "attendant"
          }
        ]
      })
    }
    
    if (type === "httpRequest") {
      return setNodes((old) => [
        ...old,
        {
          id: geraStringAleatoria(30),
          position: { x: posX, y: posY },
          data: {
            url: "",
            method: data?.method || "POST",
            requestBody: data?.requestBody || "{}",
            headersString: data?.headersString || "",
            queryParams: data?.queryParams || [],
            saveVariables: data?.saveVariables || [],
            ...data,
          },
          type: "httpRequest",
        },
      ]);
    }
    
    if (type === "variable") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              variableName: data?.variableName || "",
              variableValue: data?.variableValue || "",
              variableType: data?.variableType || "text",
              variableExpression: data?.variableExpression || "",
              isExpression: data?.isExpression || false,
              ...data,
            },
            type: "variable",
          },
        ];
      });
    }
    
    if (type === "input") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              question: data?.question || "",
              variableName: data?.variableName || "",
              ...data,
            },
            type: "input",
          },
        ];
      });
    }
  };

  // Funções de adição (mantidas)
  const textAdd = data => addNode("text", data);
  const intervalAdd = data => addNode("interval", data);
  //const conditionAdd = data => addNode("condition", data);
  const menuAdd = data => addNode("menu", data);
  const imgAdd = data => addNode("img", data);
  const audioAdd = data => addNode("audio", data);
  const randomizerAdd = data => addNode("randomizer", data);
  const videoAdd = data => addNode("video", data);
  const singleBlockAdd = data => addNode("singleBlock", data);
  const ticketAdd = data => addNode("ticket", data);
  const tagAdd = data => addNode("tag", data);
  const openaiAdd = data => addNode("openai", data);
  const geminiAdd = data => addNode("gemini", data);
  const removeTagAdd = data => addNode("removeTag", data);
  const switchFlowAdd = data => addNode("switchFlow", data);
  const attendantAdd = data => addNode("attendant", data);
  const variableAdd = data => addNode("variable", data);
  const inputAdd = data => addNode("input", data);

  // useEffect para carregar fluxo COMPLETO (mantido)
  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          if (data.flow.flow !== null) {
            const preparedNodes = data.flow.flow.nodes.map((node) => {
              if (node.type === "httpRequest") {
                console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);

                if (node.data.saveVariables && node.data.saveVariables.length > 0) {
                  console.log(
                    `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
                  );

                  if (
                    !node.data.responseVariables ||
                    !Array.isArray(node.data.responseVariables)
                  ) {
                    console.log(
                      `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
                    );
                    node.data.responseVariables = node.data.saveVariables.map(
                      (item) => ({
                        path: item.path,
                        variableName: item.variable,
                      })
                    );
                  }
                } else {
                  node.data.saveVariables = node.data.saveVariables || [];
                  node.data.responseVariables = node.data.responseVariables || [];
                }

                console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
                  url: node.data.url,
                  method: node.data.method,
                  saveVariables: node.data.saveVariables?.length || 0,
                  responseVariables: node.data.responseVariables?.length || 0,
                });
              }
              return node;
            });

            setNodes(preparedNodes);
            setEdges(data.flow.flow.connections);
          }
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  // useEffect para storage COMPLETO (mantido)
  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes(old => old.filter(item => item.id !== storageItems.node));
      setEdges(old => {
        const newData = old.filter(item => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          item => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        item => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map(node => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY
        },
        selected: false,
        style: { 
          backgroundColor: theme.palette.grey[800], 
          padding: 0, 
          borderRadius: 8,
          border: `1px solid ${theme.palette.divider}`
        }
      };
      setNodes(old => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action, nodes, theme]);

  // Função de salvar COMPLETA (mantida)
  const saveFlow = async () => {
    try {
      console.log("[FlowBuilder] Preparando para salvar fluxo...");
      const processedNodes = nodes.map((node) => {
        if (node.type === "httpRequest") {
          console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);
          if (node.data.saveVariables && node.data.saveVariables.length > 0) {
            console.log(
              `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
            );

            if (
              !node.data.responseVariables ||
              !Array.isArray(node.data.responseVariables)
            ) {
              console.log(
                `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
              );
              node.data.responseVariables = node.data.saveVariables.map(
                (item) => ({
                  path: item.path,
                  variableName: item.variable,
                })
              );
            }
          } else {
            node.data.saveVariables = node.data.saveVariables || [];
            node.data.responseVariables = node.data.responseVariables || [];
          }

          console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
            url: node.data.url,
            method: node.data.method,
            saveVariables: node.data.saveVariables?.length || 0,
            responseVariables: node.data.responseVariables?.length || 0,
          });
        }
        return node;
      });

      console.log("[FlowBuilder] Enviando fluxo para o servidor...");

      await api
        .post("/flowbuilder/flow", {
          idFlow: id,
          nodes: processedNodes,
          connections: edges,
        })
        .then((res) => {
          toast.success(i18n.t("flows.savedOk"));
          setNodes(processedNodes);
        });
    } catch (error) {
      toast.error(i18n.t("flows.saveError"));
      console.error("Erro ao salvar o fluxo:", error);
    }
  };

  // Event handlers COMPLETOS (mantidos mas adaptados para tema)
  const doubleClick = (event, node) => {
    setDataNode(node);
    if (node.type === "message") setModalAddText("edit");
    if (node.type === "interval") setModalAddInterval("edit");
    if (node.type === "menu") setModalAddMenu("edit");
    if (node.type === "img") setModalAddImg("edit");
    if (node.type === "audio") setModalAddAudio("edit");
    if (node.type === "randomizer") setModalAddRandomizer("edit");
    if (node.type === "video") setModalAddVideo("edit");
    if (node.type === "singleBlock") setModalAddSingleBlock("edit");
    if (node.type === "ticket") setModalAddTicket("edit");
    if (node.type === "tag") setModalAddTag("edit");
    if (node.type === "removeTag") setModalAddRemoveTag("edit");
    if (node.type === "switchFlow") setModalAddSwitchFlow("edit");
    if (node.type === "openai") setModalAddOpenAI("edit");
    if (node.type === "gemini") setModalAddGemini("edit");
    if (node.type === "attendant") setModalAddAttendant("edit");
    if (node.type === "httpRequest") {
      if (node.data.saveVariables && node.data.saveVariables.length > 0) {
        if (
          !node.data.responseVariables ||
          !Array.isArray(node.data.responseVariables)
        ) {
          node.data.responseVariables = node.data.saveVariables.map((item) => ({
            path: item.path,
            variableName: item.variable,
          }));

          setNodes((old) =>
            old.map((itemNode) => {
              if (itemNode.id === node.id) {
                return node;
              }
              return itemNode;
            })
          );

          console.log("[FlowBuilder] Nó HTTP Request atualizado:", node.id);
        }
      }
    }
    if (node.type === "input") setModalAddInput("edit");
  };

  const clickNode = (event, node) => {
    setNodes(old =>
      old.map(item => {
        if (item.id === node.id) {
          return {
            ...item,
            style: { 
              backgroundColor: theme.palette.primary.main, 
              padding: 1, 
              borderRadius: 8,
              border: `2px solid ${theme.palette.primary.dark}`
            }
          };
        }
        return {
          ...item,
          style: { 
            backgroundColor: theme.palette.grey[800], 
            padding: 0, 
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`
          }
        };
      })
    );
  };

  const clickEdge = (event, node) => {
    setNodes(old =>
      old.map(item => {
        return {
          ...item,
          style: { 
            backgroundColor: theme.palette.grey[800], 
            padding: 0, 
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`
          }
        };
      })
    );
  };

  const updateNode = dataAlter => {
    setNodes(old =>
      old.map(itemNode => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    // Fechar todos os modais
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddImg(null);
    setModalAddOpenAI(null);
    setModalAddAudio(null);
    setModalAddRandomizer(null);
    setModalAddVideo(null);
    setModalAddGemini(null);
    setModalAddSingleBlock(null);
    setModalAddTicket(null);
    setModalAddRemoveTag(null);
    setModalAddTag(null);
    setModalAddSwitchFlow(null);
    setModalAddAttendant(null);
    setModalAddInput(null);
  };

  // Handler para categoria expand/collapse
  //
  // Se guarda el id estable de la categoria, no su nombre visible: antes el
  // estado inicial era ['Básicos'], que coincidia con la traduccion al
  // espanol por casualidad. Cambiar esa traduccion —o mirar la pantalla en
  // otro idioma— dejaba la categoria sin abrirse, sin que nada fallara.
  const handleCategoryToggle = (categoryId) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Handler para ações de nós
  const clickActions = type => {
    setBottomSheetOpen(false);

    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "text":
        setModalAddText("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "tag":
        setModalAddTag("create");
        break;
      case "removeTag":
        setModalAddRemoveTag("create");
        break;
      case "switchFlow":
        setModalAddSwitchFlow("create");
        break;
      case "attendant":
        setModalAddAttendant("create");
        break;
      case "httpRequest":
        addNode("httpRequest");
        break;
      case "variable":
        addNode("variable");
        break;
      case "input":
        setModalAddInput("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "gemini":
        setModalAddGemini("create");
        break;
      case "img":
        setModalAddImg("create");
        break;
      case "audio":
        setModalAddAudio("create");
        break;
      case "video":
        setModalAddVideo("create");
        break;
      default:
    }
  };

  // Componente do Sidebar
  const SidebarContent = () => (
    <div className={classes.sidebarContent}>
      {nodeCategories.map((category) => (
        <div key={category.id}>
          {sidebarOpen ? (
            // Modo expandido
            <>
              <div className={classes.categoryHeader}>
                <Box 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="space-between"
                  onClick={() => handleCategoryToggle(category.id)}
                  style={{ cursor: "pointer" }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ color: typeof category.color === 'function' ? category.color(theme) : category.color }}>
                      {category.icon}
                    </Box>
                    <Typography variant="body2">
                      {category.name}
                    </Typography>
                  </Box>
                  {expandedCategories.includes(category.id) ? <ExpandLess /> : <ExpandMore />}
                </Box>
              </div>
              
              <Collapse in={expandedCategories.includes(category.id)}>
                <List dense>
                  {category.nodes.map((node) => (
                    <ListItem key={node.type} disablePadding>
                      <Button
                        fullWidth
                        variant="text"
                        className={classes.nodeButton}
                        onClick={() => clickActions(node.type)}
                        startIcon={
                          <Box sx={{ color: typeof category.color === 'function' ? category.color(theme) : category.color }}>
                            {node.icon}
                          </Box>
                        }
                      >
                        <Box textAlign="left" width="100%">
                          <Typography variant="body2">
                            {node.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {node.description}
                          </Typography>
                        </Box>
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </>
          ) : (
            // Modo colapsado - só ícones
            <div>
              {category.nodes.map((node) => (
                <Tooltip key={node.type} title={node.name} placement="right">
                  <IconButton
                    className={classes.collapsedNodeButton}
                    onClick={() => clickActions(node.type)}
                    style={{ color: typeof category.color === 'function' ? category.color(theme) : category.color }}
                  >
                    {node.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Componente do Bottom Sheet
  const BottomSheetContent = () => (
    <Slide direction="up" in={bottomSheetOpen} mountOnEnter unmountOnExit>
      <div className={classes.bottomSheet}>
        <div 
          className={classes.bottomSheetHandle}
          onClick={() => setBottomSheetOpen(false)}
        />
        
        <div className={classes.bottomSheetHeader}>
          <Typography variant="h6">{i18n.t("flows.addNodes")}</Typography>
          <IconButton onClick={() => setBottomSheetOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </div>
        
        <div className={classes.bottomSheetContent}>
          <Grid container spacing={2}>
            {nodeCategories.map((category) => (
              <Grid item xs={6} key={category.id}>
                <Paper elevation={1} className={classes.categoryCard} style={{ padding: 8 }}>
                  <Typography 
                    variant="subtitle2" 
                    className={classes.categoryTitle}
                    style={{ color: typeof category.color === 'function' ? category.color(theme) : category.color, marginBottom: 8 }}
                  >
                    {category.name}
                  </Typography>
                  {category.nodes.map((node) => (
                    <Button
                      key={node.type}
                      fullWidth
                      variant="outlined"
                      onClick={() => clickActions(node.type)}
                      startIcon={
                        <Box sx={{ color: typeof category.color === 'function' ? category.color(theme) : category.color }}>
                          {node.icon}
                        </Box>
                      }
                      className={classes.categoryNodeBtn}
                      size="small"
                    >
                      {node.name}
                    </Button>
                  ))}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </div>
      </div>
    </Slide>
  );

  if (loading) {
    return (
      <div className={classes.root}>
        <div className={classes.header}>
          <MainHeader>
            <Title>{i18n.t("flows.title")}</Title>
          </MainHeader>
        </div>
        <div className={classes.loadingContainer}>
          <CircularProgress style={{ color: theme.palette.primary.main }} />
        </div>
      </div>
    );
  }

  return (
 <div className={classes.root}>
    {/* Header */}
    <div className={classes.header}>
      <MainHeader>
        <Title>{i18n.t("flows.title")}</Title>
      </MainHeader>
    </div>

    {/* Content */}
    <div className={classes.content}>
      {/* Sidebar Desktop */}
      {!isMobile && (
        <div className={classes.sidebar}>
          <div className={classes.sidebarHeader}>
            {sidebarOpen && (
              <Typography variant="subtitle1" fontWeight="bold">
                {i18n.t("flows.addNodes")}
              </Typography>
            )}
            <IconButton 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              size="small"
            >
              {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
            </IconButton>
          </div>
          <SidebarContent />
        </div>
      )}

      {/* Flow Container */}
      <div className={classes.flowContainer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          deleteKeyCode={["Backspace", "Delete"]}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={doubleClick}
          onNodeClick={clickNode}
          onEdgeClick={clickEdge}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          connectionLineStyle={connectionLineStyle}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            style: { 
              color: theme.palette.primary.main, 
              strokeWidth: isMobileDevice() ? "8px" : "6px"
            },
            animated: false
          }}
          // Configurações otimizadas para mobile
          //
          // La rueda hace zoom directamente, sin Ctrl. Antes panOnScroll
          // estaba activo, y con el la rueda desplazaba el lienzo: la
          // libreria reservaba entonces el zoom para cuando se mantiene
          // pulsada la tecla modificadora. El desplazamiento no se pierde,
          // pasa a hacerse arrastrando el fondo (panOnDrag, activo por
          // defecto), que es como funcionan Figma o Miro.
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={false}
          zoomOnDoubleClick={true}
          selectNodesOnDrag={false}
          snapToGrid={true}
          snapGrid={[20, 20]}
          // El rango se recorta por los extremos, que eran inutilizables: al
          // 10% los nodos no se leen y al 300% no cabe nada. Ojo, esto NO
          // cambia cuanto salta cada muesca de la rueda —esta version de
          // react-flow-renderer no expone ningun prop de paso de zoom, se
          // comprobo en sus definiciones de tipos—, solo limita hasta donde
          // se puede llegar.
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          {/* Controles sempre visíveis em desktop */}
          {!isMobile && <Controls />}
          
          {/* Removido o MiniMap completamente */}
          
          <Background 
            variant="dots" 
            gap={12} 
            size={-1} 
            color={theme.palette.type === 'dark' ? '#333' : '#aaa'}
          />
        </ReactFlow>

        {/* Desktop: guardar y accesos rapidos, en una sola columna que
            calcula ella misma su separacion.

            Va DENTRO del lienzo a proposito. Estando fuera se anclaba al
            viewport, y el boton de guardar acababa metido debajo de la barra
            superior de la aplicacion. Aqui se mide contra el lienzo, que es
            donde el usuario espera verlos, y sigue en su sitio aunque cambie
            la altura de esa barra o el ancho del menu lateral. */}
        {!isMobile && (
          <div className={classes.toolbarDock}>
            <Fab
              color="primary"
              onClick={saveFlow}
              title={i18n.t("flows.saveFlow")}
            >
              <SaveIcon />
            </Fab>

            <QuickActions onActionClick={clickActions} />
          </div>
        )}
      </div>
    </div>

    {/* Mobile Controls */}
    {isMobile && <MobileControls />}

    {/* Mobile: el guardar se queda abajo, donde llega el pulgar. */}
    {isMobile && (
      <Fab
        color="primary"
        className={classes.fab}
        onClick={saveFlow}
        title={i18n.t("flows.saveFlow")}
      >
        <SaveIcon />
      </Fab>
    )}

    {/* Bottom Sheet Mobile */}
    {isMobile && <BottomSheetContent />}

    {/* FAB Adicionar - só em mobile */}
    {isMobile && (
      <Fab
        color="secondary"
        className={classes.addFab}
        onClick={() => setBottomSheetOpen(true)}
      >
        <AddIcon />
      </Fab>
    )}

    {/* Click Away Listener para Bottom Sheet */}
    {isMobile && bottomSheetOpen && (
      <ClickAwayListener onClickAway={() => setBottomSheetOpen(false)}>
        <div />
      </ClickAwayListener>
    )}

      {/* TODOS OS MODAIS COMPLETOS - mantidos iguais */}
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />
      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />
      <FlowBuilderGeminiModal
        open={modalAddGemini}
        onSave={geminiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddGemini}
      />
      <FlowBuilderAddTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />
      <FlowBuilderRemoveTagModal
        open={modalAddRemoveTag}
        onSave={removeTagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddRemoveTag(null)}
      />
      <FlowBuilderAddSwitchFlowModal
        open={modalAddSwitchFlow}
        onSave={switchFlowAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSwitchFlow}
      />
      <FlowBuilderAddAttendantModal
        open={modalAddAttendant}
        onSave={attendantAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAttendant}
      />
      <FlowBuilderInputModal
        open={modalAddInput}
        onSave={inputAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInput}
      />
    </div>
  );
};