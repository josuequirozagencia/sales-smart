import React, { useContext, useState, useEffect, useReducer, useRef, useCallback, useMemo } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";
import { isNil } from "lodash";
import { blue, green } from "@material-ui/core/colors";
import { VariableSizeList as List } from 'react-window';
import {
  Button,
  CircularProgress,
  Divider,
  Typography,
  IconButton,
  makeStyles,
  useTheme
} from "@material-ui/core";

// Iconos en trazo del set propio del proyecto — ver components/Icons.
// Facebook/Instagram/WhatsApp quedan con los de Material-UI: son iconos de
// marca, no se unifican con el resto del sistema visual.
import {
  AccessTime,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Reply,
  LockIcon,
} from "../Icons";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";
import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import YouTubePreview from "../ModalYoutubeCors";
import PdfPreview from "../PdfPreview";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import AdMetaPreview from "../AdMetaPreview";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import SelectMessageCheckbox from "./SelectMessageCheckbox";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import useSettings from "../../hooks/useSettings";
import { getBackendUrl } from "../../config";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";
import AudioModal from "../AudioModal";
import { useParams, useHistory } from 'react-router-dom';
import { downloadResource } from "../../utils";
import Template from "./templates";
import { usePdfViewer } from "../../hooks/usePdfViewer";
import { basename } from "../../utils/basename";

// Hook customizado para memoizar formatação de datas
const useFormattedDate = (dateString, formatString = "HH:mm") => {
  return useMemo(() => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), formatString);
    } catch (error) {
      console.error("Error formatting date:", error);
      return '';
    }
  }, [dateString, formatString]);
};

// Componente memoizado para timestamp
const MessageTimestamp = React.memo(({ createdAt, isEdited }) => {
  const formattedTime = useFormattedDate(createdAt, "HH:mm");
  return <>{isEdited ? `Editada ${formattedTime}` : formattedTime}</>;
});

// Componente memoizado para preview do YouTube
const YouTubePreviewMemo = React.memo(({ videoUrl }) => {
  return <YouTubePreview videoUrl={videoUrl} />;
});

// Espacio reservado a la derecha del texto para la hora y el tic de entrega,
// que van en posicion absoluta sobre la burbuja. Medido en pantalla: el bloque
// ocupa 51px y se separa 5 del borde. Con los 80 de antes, un mensaje corto
// como "Dime" ocupaba una burbuja con un hueco vacio de casi dos dedos.
const ESPACIO_HORA = 62;

const useStyles = makeStyles((theme) => ({
  // Aviso de la ventana de 24h de Meta. Estaba escrito a mano con un azul
  // claro fijo y sin color de texto: en modo oscuro heredaba el blanco del
  // tema y quedaba ilegible sobre ese fondo. Ademas se llevaba 40px de alto
  // justo encima del campo de escribir, que es donde hace falta el sitio.
  aviso24h: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: theme.palette.tokens.space.sm,
    padding: "5px 12px",
    fontSize: "0.75rem",
    lineHeight: 1.35,
    backgroundColor:
      theme.mode === "dark"
        ? "rgba(59, 130, 246, 0.16)"
        : theme.palette.tokens.semantic.info.soft,
    color:
      theme.mode === "dark" ? "#bfdbfe" : theme.palette.tokens.semantic.info.text,
    "& svg": {
      fontSize: 16,
      flexShrink: 0,
    },
  },

  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 300,
    minHeight: 200,
  },

  currentTick: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "95%",
    backgroundColor: theme.palette.primary.main,
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "1px 5px 10px #b3b3b3",
  },

  currentTicktText: {
    color: theme.palette.primary,
    fontWeight: 'bold',
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  messagesList: {
    // Fondo del hilo.
    //
    // Antes llevaba fija la imagen de garabatos de WhatsApp. Ahora es una
    // superficie del sistema, y el papel tapiz —si la empresa configura
    // uno en Ajustes > Whitelabel— se aplica en linea desde el componente,
    // porque makeStyles no puede leer un ajuste.
    //
    // El hilo va un peldano por DEBAJO de las burbujas. Se usa
    // surfaceSecondary y no background porque, quitada la textura del papel
    // tapiz, una burbuja blanca sobre un fondo casi blanco se quedaba en
    // 1,05 de contraste: el borde solo se adivinaba por la sombra. Aun asi
    // el peso lo lleva el filete de 1px de cada burbuja; entre dos tonos
    // claros ninguna diferencia de luminancia llega a 3:1.
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 30px 20px",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  dragElement: {
    background: 'rgba(255, 255, 255, 0.8)',
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 999999,
    textAlign: "center",
    fontSize: "3em",
    border: "5px dashed #333",
    color: '#333',
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  circleLoading: {
    color: blue[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  // Burbuja del cliente.
  //
  // Se conserva el CODIGO de color —una superficie neutra el cliente, un
  // tono de marca el asesor— porque es lo que permite saber quien habla
  // sin leer. Lo que cambia son los valores: el verde de WhatsApp da paso
  // a la escala de marca, y la geometria (radio, relleno, sombra) al
  // sistema de diseno.
  messageLeft: {
    marginRight: 20,
    marginTop: 8,
    // Se retira el minWidth de 100px: obligaba a que un "Ok" o un "Si"
    // ocuparan una caja de 100 pixeles, y en una conversacion con respuestas
    // cortas la columna quedaba llena de burbujas vacias.
    maxWidth: "min(600px, 82%)",
    height: "auto",
    display: "block",
    position: "relative",
    // Una URL larga o una palabra sin espacios desbordaba la burbuja. Con
    // esto se parte donde haga falta en lugar de empujar el ancho.
    overflowWrap: "anywhere",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    // Burbuja recibida: la superficie del sistema. En claro ya era blanca;
    // en oscuro era el #202c33 de WhatsApp y pasa al gris del sistema.
    backgroundColor: theme.palette.tokens.surface.surface,
    // El color del texto se calcula sobre el fondo, no se fija a mano.
    color: theme.palette.tokens.onColor(theme.palette.tokens.surface.surface),
    // Filete que define el borde. Es lo que separa la burbuja del hilo:
    // entre dos tonos claros la luminancia no da para distinguirlos, y una
    // linea de 1px se percibe como contorno aunque su contraste sea bajo.
    border: `1px solid ${theme.palette.tokens.border.border}`,
    alignSelf: "flex-start",
    // Radio de 14px con la esquina de origen a 4: mantiene la punta que
    // indica quien habla, pero sin el angulo recto, que es lo que daba
    // aspecto antiguo.
    borderTopLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: "8px 10px 6px",
    // La sombra era "0 1px 1px #b3b3b3": gris solido y practicamente sin
    // difuminado, el rasgo que mas delataba la edad de la interfaz.
    boxShadow: theme.mode === 'light'
      ? theme.palette.tokens.shadow.sm
      : "0 1px 2px rgba(0, 0, 0, 0.4)",
  },

  quotedContainerLeft: {
    margin: `-3px -${ESPACIO_HORA}px 6px -6px`,
    overflow: "hidden",
    // Insercion de la cita dentro de la burbuja recibida: un peldano de
    // superficie por debajo, en vez de los grises de WhatsApp.
    backgroundColor: theme.palette.tokens.surface.surfaceSecondary,
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#388aff",
  },

  // Burbuja del asesor. Mismo tratamiento, con la punta en el otro lado.
  messageRight: {
    marginLeft: 20,
    marginTop: 8,
    // Se retira el minWidth de 100px: obligaba a que un "Ok" o un "Si"
    // ocuparan una caja de 100 pixeles, y en una conversacion con respuestas
    // cortas la columna quedaba llena de burbujas vacias.
    maxWidth: "min(600px, 82%)",
    height: "auto",
    display: "block",
    position: "relative",
    // Una URL larga o una palabra sin espacios desbordaba la burbuja. Con
    // esto se parte donde haga falta en lugar de empujar el ancho.
    overflowWrap: "anywhere",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    // Burbuja propia: un tono de la escala de MARCA, no el verde de
    // WhatsApp (#dcf8c6 en claro, #005c4b en oscuro). Sigue distinguiendose
    // de la recibida de un vistazo, pero con el color del producto.
    backgroundColor: theme.mode === 'light'
      ? theme.palette.tokens.brandScale[50]
      : theme.palette.tokens.brandScale[900],
    color: theme.palette.tokens.onColor(
      theme.mode === 'light'
        ? theme.palette.tokens.brandScale[50]
        : theme.palette.tokens.brandScale[900]
    ),
    // Mismo criterio que la burbuja recibida, con un paso de la escala de
    // marca para que el contorno pertenezca a la misma familia de color.
    border: `1px solid ${theme.mode === 'light'
      ? theme.palette.tokens.brandScale[100]
      : theme.palette.tokens.brandScale[700]}`,
    alignSelf: "flex-end",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
    padding: "8px 10px 6px",
    boxShadow: theme.mode === 'light'
      ? theme.palette.tokens.shadow.sm
      : "0 1px 2px rgba(0, 0, 0, 0.4)",
  },

  messageRightPrivate: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#F0E68C",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === 'light' ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000"
  },

  quotedContainerRight: {
    margin: `-3px -${ESPACIO_HORA}px 6px -6px`,
    overflowY: "hidden",
    // Esta cita va DENTRO de la burbuja propia, que ya es de marca: se usa
    // un paso mas de la misma escala para que se distinga sin salirse de
    // la familia de color. Antes eran los verdes de WhatsApp.
    backgroundColor: theme.mode === 'light'
      ? theme.palette.tokens.brandScale[100]
      : theme.palette.tokens.brandScale[700],
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: `3px ${ESPACIO_HORA}px 6px 6px`,
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: `3px ${ESPACIO_HORA}px 6px 6px`,
  },

  messageMedia: {
    objectFit: "cover",
    width: 400,
    height: "auto",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  forwardMessage: {
    fontSize: 12,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: "#999",
    display: "flex",
    alignItems: "center"
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: blue[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  ackPlayedIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
    color: theme.mode === "light" ? theme.palette.light : theme.palette.dark,
  },

  messageCenter: {
    marginTop: 5,
    alignItems: "center",
    verticalAlign: "center",
    alignContent: "center",
    backgroundColor: "#E1F5FEEB",
    fontSize: "12px",
    minWidth: 100,
    maxWidth: 270,
    color: "#272727",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  deletedMessage: {
    color: '#f55d65'
  }
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = Array.isArray(action.payload) ? action.payload : [];
    const newMessages = [];

    messages.forEach((message) => {

      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagesList = ({
  isGroup,
  onDrop,
  whatsappId,
  queueId,
  channel,
  ticketStatus
}) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const history = useHistory();
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const { ticketId } = useParams();

  const currentTicketId = useRef(ticketId);
  const { getAll } = useCompanySettings();
  // Papel tapiz del hilo, opcional. Se sube en Ajustes > Whitelabel y se
  // guarda como chatBackgroundLight / chatBackgroundDark. Vacio significa
  // sin imagen: la superficie lisa del sistema, que es lo que se ve por
  // defecto desde que se quito la de WhatsApp.
  const [papelTapiz, setPapelTapiz] = useState("");
  const theme = useTheme();
  const { getPublicSetting } = useSettings();
  const [dragActive, setDragActive] = useState(false);
  const [dragTimeout, setDragTimeout] = useState(null);

  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState(false);
  const { selectedQueuesMessage } = useContext(QueueSelectedContext);

  // Hook simplificado para PDF
  const {
    downloadPdf,
    extractPdfInfoFromMessage,
    isPdfUrl
  } = usePdfViewer();

  const { showSelectMessageCheckbox } = useContext(ForwardMessageContext);
  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;

  // Papel tapiz configurado por la empresa, si lo hay.
  //
  // Se pide una clave distinta por modo para que un fondo pensado para el
  // modo claro no se quede pegado en el oscuro. Si la lectura falla no se
  // pone imagen y queda la superficie lisa: un fondo es adorno, y no puede
  // dejar el hilo sin pintar.
  useEffect(() => {
    const clave =
      theme.mode === "light" ? "chatBackgroundLight" : "chatBackgroundDark";
    let vigente = true;

    // Se pasa la empresa: sin ella el ajuste se lee de la empresa 1, y
    // todas verian el papel tapiz de la instalacion anfitriona en vez del
    // suyo.
    getPublicSetting(clave, companyId)
      .then((fichero) => {
        if (!vigente) return;
        setPapelTapiz(fichero ? `${getBackendUrl()}/public/${fichero}` : "");
      })
      .catch(() => {
        if (vigente) setPapelTapiz("");
      });

    // Evita escribir en un componente ya desmontado si la peticion tarda.
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.mode, companyId]);

  useEffect(() => {
    async function fetchData() {
      try {
      const settings = await getAll(companyId);
      const safeSettings = settings && typeof settings === "object" ? settings : {};

      let settinglgpdDeleteMessage;
      let settingEnableLGPD;

      for (const [key, value] of Object.entries(safeSettings)) {
        if (key === "lgpdDeleteMessage") settinglgpdDeleteMessage = value
        if (key === "enableLGPD") settingEnableLGPD = value
      }
      if (settingEnableLGPD === "enabled" && settinglgpdDeleteMessage === "enabled") {
        setLGPDDeleteMessage(true);
      }
      } catch (err) {
        toastError(err);
      }
    }
    fetchData();
  }, [])

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    currentTicketId.current = ticketId;
  }, [ticketId, selectedQueuesMessage]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === "undefined") {
          history.push("/tickets");
          return;
        }
        if (isNil(ticketId)) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber, selectedQueues: JSON.stringify(selectedQueuesMessage) },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
            setLoadingMore(false);
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
          setLoadingMore(false);
        }
      };

      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, selectedQueuesMessage]);

  useEffect(() => {
    if (ticketId === "undefined") {
      return;
    }

    const companyId = user.companyId;

    const connectEventMessagesList = () => {
      socket.emit("joinChatBox", `${ticketId}`);
    }

    const onAppMessageMessagesList = (data) => {
      if (data.action === "create" && data.ticket.uuid === ticketId) {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        scrollToBottom();
      }

      if (data.action === "update" && data?.message?.ticket?.uuid === ticketId) {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }

      if (data.action == "delete" && data.message.ticket?.uuid === ticketId) {
        dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
      }
    }
    socket.on("connect", connectEventMessagesList);
    socket.on(`company-${companyId}-appMessage`, onAppMessageMessagesList);

    return () => {
      socket.emit("joinChatBoxLeave", `${ticketId}`)
      socket.off("connect", connectEventMessagesList);
      socket.off(`company-${companyId}-appMessage`, onAppMessageMessagesList);
    };

  }, [ticketId]);

  useEffect(() => {
    return () => {
      if (dragTimeout) {
        clearTimeout(dragTimeout);
      }
    };
  }, [dragTimeout]);

  // Failsafe: se o overlay de drag ficar preso, encerra automaticamente
  useEffect(() => {
    if (!dragActive) return;

    const autoCancel = setTimeout(() => setDragActive(false), 2500);

    const cancelDrag = () => setDragActive(false);
    window.addEventListener('drop', cancelDrag, true);
    window.addEventListener('dragend', cancelDrag, true);
    window.addEventListener('keyup', (e) => { if (e.key === 'Escape') cancelDrag(); }, true);

    return () => {
      clearTimeout(autoCancel);
      window.removeEventListener('drop', cancelDrag, true);
      window.removeEventListener('dragend', cancelDrag, true);
    };
  }, [dragActive]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({});
      }
    }, 100);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const hanldeReplyMessage = (e, message) => {
    setAnchorEl(null);
    setReplyingMessage(message);
  };

  // Memoizar verificação de mídia
  const checkMessageMedia = useCallback((message) => {
    const isAudioMessage = (message) => {
      if (message.mediaType === "audio") {
        console.log("🎵 Detectado como áudio pelo mediaType:", message.mediaType);
        return true;
      }

      if (message.mediaUrl) {
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
        const url = message.mediaUrl.toLowerCase();
        const hasAudioExtension = audioExtensions.some(ext => url.includes(ext));

        if (hasAudioExtension) {
          console.log("🎵 Detectado como áudio pela URL:", url);
          return true;
        }
      }

      if (message.body && typeof message.body === 'string') {
        const body = message.body.toLowerCase();
        const isAudioBody = body.includes('áudio gravado') ||
          body.includes('audio_') ||
          body.includes('🎵') ||
          body.includes('arquivo de áudio') ||
          body.includes('mensagem de voz');

        if (isAudioBody) {
          console.log("🎵 Detectado como áudio pelo body:", body);
          return true;
        }
      }

      return false;
    };

    // Templates
    if (message.mediaType === "template") {
      return <Template message={message} />;
    }

    // Localização
    else if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|');
      let imageLocation = locationParts[0];
      let linkLocation = locationParts[1];
      let descriptionLocation = locationParts.length > 2 ? locationParts[2] : null;

      return <LocationPreview 
        image={imageLocation} 
        link={linkLocation} 
        description={descriptionLocation} 
      />;
    }

    // Contatos
    else if (message.mediaType === "contactMessage") {
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      
      return <VcardPreview 
        contact={contact} 
        numbers={obj[0]?.number} 
        queueId={message?.ticket?.queueId} 
        whatsappId={message?.ticket?.whatsappId} 
        channel={channel} 
      />;
    }

    else if (message.mediaType === "adMetaPreview") { // Adicionado para renderizar o componente de preview de anúncio
      console.log("Entrou no MetaPreview");
      let [image, sourceUrl, title, body] = message.body.split('|');
      let messageUser = "Olá! Tenho interesse e queria mais informações, por favor.";
      return <AdMetaPreview image={image} sourceUrl={sourceUrl} title={title} body={body} messageUser={messageUser} />;
    }

    // PDF e Documentos - SÓ DOWNLOAD
    else if (isPdfUrl(message.mediaUrl, message.body, message.mediaType)) {
      
      console.log("📄 Renderizando como documento/PDF:", message.id);
      const pdfInfo = extractPdfInfoFromMessage(message);

      return (
        <PdfPreview
          url={pdfInfo.url}
          filename={pdfInfo.filename}
          size={pdfInfo.size}
          mediaType={pdfInfo.mediaType}
          onDownload={(url, name) => {
            console.log("📥 Download PDF solicitado:", { url, name });
            downloadPdf(url, name);
          }}
        />
      );
    }

    // Áudio
    else if (isAudioMessage(message)) {
      console.log("🎵 Renderizando como áudio:", message.id);
      return (
        <div style={{
          width: '100%',
          maxWidth: '300px',
          padding: '8px',
          backgroundColor: 'transparent'
        }}>
          <AudioModal
            url={message.mediaUrl}
            message={message}
          />
        </div>
      );
    }

    // Imagens
    else if (message.mediaType === "image") {
      console.log("🖼️ Renderizando como imagem");
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    }

    // Vídeos
    else if (message.mediaType === "video") {
      console.log("🎥 Renderizando como vídeo");
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
        />
      );
    }

    // Outros tipos de arquivo
    else if (message.mediaUrl) {
      console.log("📎 Renderizando como download genérico");
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              variant="outlined"
              onClick={() => downloadPdf(message.mediaUrl, message.body || 'arquivo')}
            >
              Download
            </Button>
          </div>
          <Divider />
        </>
      );
    }

    return null;
  }, [channel, classes, downloadPdf, isPdfUrl, extractPdfInfoFromMessage]);

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    } else
      if (message.ack === 1) {
        return <Done fontSize="small" className={classes.ackIcons} />;
      } else
        if (message.ack === 2) {
          return <DoneAll fontSize="small" className={classes.ackIcons} />;
        } else
          if (message.ack === 3 || message.ack === 4) {
            return <DoneAll fontSize="small" className={message.mediaType === "audio" ? classes.ackPlayedIcon : classes.ackDoneAllIcon} />;
          } else
            if (message.ack === 5) {
              return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />
            }
  };

  const renderDailyTimestamps = (message, index) => {
    const today = format(new Date(), "dd/MM/yyyy")

    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? i18n.t("chat2.today") : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    } else
      if (index < messagesList.length - 1) {
        let messageDay = parseISO(messagesList[index].createdAt);
        let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

        if (!isSameDay(messageDay, previousMessageDay)) {
          return (
            <span
              className={classes.dailyTimestamp}
              key={`timestamp-${message.id}`}
            >
              <div className={classes.dailyTimestampText}>
                {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? i18n.t("chat2.today") : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
              </div>
            </span>
          );
        }
      } else
        if (index === messagesList.length - 1) {
          return (
            <div
              key={`ref-${message.id}`}
              ref={lastMessageRef}
              style={{ float: "left", clear: "both" }}
            />
          );
        }
  };

  const renderTicketsSeparator = (message, index) => {
    let lastTicket = messagesList[index - 1]?.ticketId;
    let currentTicket = message.ticketId;

    if (lastTicket !== currentTicket && lastTicket !== undefined) {
      if (message?.ticket?.queue) {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}a`}
          >
            <div
              className={classes.currentTicktText}
              style={{ backgroundColor: message?.ticket?.queue?.color || "grey" }}
            >
              #{i18n.t("ticketsList.called")} {message?.ticketId} - {message?.ticket?.queue?.name}
            </div>

          </span>
        );
      } else {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}b`}
          >
            <div
              className={classes.currentTicktText}
              style={{ backgroundColor: "grey" }}
            >
              #{i18n.t("ticketsList.called")} {message.ticketId} - {i18n.t("ticketsList.noQueue")}
            </div>

          </span>
        );
      }
    }

  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;
      if (messageUser !== previousMessageUser) {
        return (

          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };


  const renderQuotedMessage = (message) => {

    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio"
            && (
              <div className={classes.downloadMedia}>
                <AudioModal url={message.quotedMsg.mediaUrl} />
              </div>
            )
          }
          {message.quotedMsg.mediaType === "video"
            && (
              <video
                className={classes.messageMedia}
                src={message.quotedMsg.mediaUrl}
                controls
              />
            )
          }
          {message.quotedMsg.mediaType === "contactMessage"
            && (
              "Contato"
            )
          }
          {message.quotedMsg.mediaType === "application"
            && (
              <div className={classes.downloadMedia}>
                <Button
                  startIcon={<GetApp />}
                  variant="outlined"
                  target="_blank"
                  href={message.quotedMsg.mediaUrl}
                >
                  Download
                </Button>
              </div>
            )
          }

          {message.quotedMsg.mediaType === "image"
            && (
              <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />)
            || message.quotedMsg?.body}

          {!message.quotedMsg.mediaType === "image" && message.quotedMsg?.body}

        </div>
      </div>
    );
  };

  const handleDrag = useCallback(event => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      const hasFiles = event.dataTransfer &&
        event.dataTransfer.types &&
        (event.dataTransfer.types.includes('Files') ||
          event.dataTransfer.types.includes('application/x-moz-file'));

      if (hasFiles) {
        if (dragTimeout) {
          clearTimeout(dragTimeout);
        }

        const timeout = setTimeout(() => {
          if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
            setDragActive(true);
          }
        }, 100);

        setDragTimeout(timeout);
      }
    } else if (event.type === "dragleave") {
      if (dragTimeout) {
        clearTimeout(dragTimeout);
        setDragTimeout(null);
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setDragActive(false);
      }
    }
  }, [dragTimeout]);

  // Memoizar verificação de YouTube
  const isYouTubeLink = useCallback((url) => {
    if (!url) return false;
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
  }, []);

  const handleDrop = event => {
    event.preventDefault();
    event.stopPropagation();

    if (dragTimeout) {
      clearTimeout(dragTimeout);
      setDragTimeout(null);
    }

    setDragActive(false);

    if (event.dataTransfer.files &&
      event.dataTransfer.files.length > 0 &&
      event.dataTransfer.files[0] instanceof File) {
      if (onDrop) {
        onDrop(event.dataTransfer.files);
      }
    }
  }
  const xmlRegex = /<([^>]+)>/g;
  const boldRegex = /\*(.*?)\*/g;

  const formatXml = (xmlString) => {
    // Verifica se o XML contém a assinatura com nome do atendente
    if (boldRegex.test(xmlString)) {
      // Formata o texto dentro da assinatura em negrito
      xmlString = xmlString.replace(boldRegex, "**$1**");
    }
    return xmlString;
  };

  // Memoização da lista de mensagens renderizadas
  const renderMessages = useMemo(() => {
    return () => {
      if (messagesList.length > 0) {
        const viewMessagesList = messagesList.map((message, index) => {
        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageCenter}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}

                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                    <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                  </svg> <span>{i18n.t("ticketsList.missedCall")} <MessageTimestamp createdAt={message.createdAt} isEdited={false} /></span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={classes.messageLeft}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    message={message}
                  />
                )}
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>

                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}
                    ><Reply style={{ color: "grey", transform: 'scaleX(-1)' }} /> Encaminhada
                    </span>
                    <br />
                  </div>
                )}
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                {isYouTubeLink(message.body) && (
                  <>
                    <YouTubePreview videoUrl={message.body} />
                  </>
                )}

                {!lgpdDeleteMessage && message.isDeleted && (
                  <div>
                    <span className={classes.deletedMessage}
                    >🚫 Essa mensagem foi apagada pelo contato &nbsp;
                    </span>
                  </div>
                )}

                {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "contactMessage" || message.mediaType === "template" && message.mediaType === "adMetaPreview"
                ) && checkMessageMedia(message)}

                <div className={clsx(classes.textContentItem, {
                  [classes.textContentItemDeleted]: message.isDeleted,
                })}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {
                    message.mediaType !== "adMetaPreview" && (
                      (message.mediaUrl !== null && (message.mediaType === "image" || message.mediaType === "video") && basename(message.mediaUrl).trim() !== message.body.trim()) ||
                      message.mediaType !== "audio" &&
                      message.mediaType !== "image" &&
                      message.mediaType !== "video" &&
                      message.mediaType != "reactionMessage" &&
                      message.mediaType != "locationMessage" &&
                      message.mediaType !== "contactMessage" &&
                      message.mediaType !== "template"
                    ) && (
                      <>
                        {xmlRegex.test(message.body) && (
                          <span>{message.body}</span>

                        )}
                        {!xmlRegex.test(message.body) && (
                          <MarkdownWrapper>{(lgpdDeleteMessage && message.isDeleted) ? "🚫 _Mensagem apagada_ " :
                            message.body
                          }</MarkdownWrapper>)}

                      </>

                    )}

                  {message.quotedMsg && message.mediaType === "reactionMessage" && (
                    <>
                      <span style={{ marginLeft: "0px" }}>
                        <MarkdownWrapper>
                          {"" + message?.contact?.name + " reagiu... " + message.body}
                        </MarkdownWrapper>
                      </span>
                    </>
                  )}

                  <span className={classes.timestamp}>
                    <MessageTimestamp createdAt={message.createdAt} isEdited={message.isEdited} />
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={message.isPrivate ? classes.messageRightPrivate : classes.messageRight}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    message={message}
                  />
                )}

                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}
                    ><Reply style={{ color: "grey", transform: 'scaleX(-1)' }} /> Encaminhada
                    </span>
                    <br />
                  </div>
                )}
                {isYouTubeLink(message.body) && (
                  <>
                    <YouTubePreview videoUrl={message.body} />
                  </>
                )}
                {!lgpdDeleteMessage && message.isDeleted && (
                  <div>
                    <span className={classes.deletedMessage}
                    >🚫 Essa mensagem foi apagada &nbsp;
                    </span>
                  </div>
                )}
                {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "contactMessage" || message.mediaType === "template"
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >

                  {message.quotedMsg && renderQuotedMessage(message)}

                  {
                    ((message.mediaType === "image" || message.mediaType === "video") && basename(message.mediaUrl) === message.body) ||
                    (message.mediaType !== "audio" && message.mediaType != "reactionMessage" && message.mediaType != "locationMessage" && message.mediaType !== "contactMessage" && message.mediaType !== "template") && (
                      <>
                        {xmlRegex.test(message.body) && (
                          <div>{formatXml(message.body)}</div>

                        )}
                        {!xmlRegex.test(message.body) && (<MarkdownWrapper>{message.body}</MarkdownWrapper>)}

                      </>
                    )}

                  {message.quotedMsg && message.mediaType === "reactionMessage" && (
                    <>
                      <span style={{ marginLeft: "0px" }}>
                        <MarkdownWrapper>
                          {"Você reagiu... " + message.body}
                        </MarkdownWrapper>
                      </span>
                    </>
                  )}

                  <span className={classes.timestamp}>
                    <MessageTimestamp createdAt={message.createdAt} isEdited={message.isEdited} />
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
        });
        return viewMessagesList;
      } else {
        return <div>Diga olá para seu novo contato!</div>;
      }
    };
  }, [messagesList, classes, isGroup, showSelectMessageCheckbox, lgpdDeleteMessage, 
      renderDailyTimestamps, renderTicketsSeparator, renderMessageDivider, 
      handleOpenMessageOptionsMenu, hanldeReplyMessage, checkMessageMedia, 
      renderQuotedMessage, isYouTubeLink, renderMessageAck, xmlRegex, formatXml]);
const shouldBlurMessages = ticketStatus === "pending" && user.allowSeeMessagesInPendingTickets === "disabled";

  return (
    <div className={classes.messagesListWrapper} onDragEnter={handleDrag}>
      {dragActive && <div className={classes.dragElement} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>Solte o arquivo aqui</div>}
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
        isGroup={isGroup}
        whatsappId={whatsappId}
        queueId={queueId}
      />
      

<div
  id="messagesList"
  className={classes.messagesList}
  onScroll={handleScroll}
  style={{
    filter: shouldBlurMessages ? "blur(4px)" : "none",
    pointerEvents: shouldBlurMessages ? "none" : "auto",
    // Sin papel tapiz configurado no se pone imagen: manda el color de
    // fondo que define la clase.
    ...(papelTapiz ? { backgroundImage: `url(${papelTapiz})` } : {})
  }}
>
  {messagesList.length > 0 ? renderMessages() : []}
</div>

      {(channel !== "whatsapp" && channel !== undefined) && (
        <div className={classes.aviso24h}>
          {channel === "facebook" ? (
            <Facebook />
          ) : channel === "instagram" ? (
            <Instagram />
          ) : (
            <WhatsApp />
          )}

          <span>{i18n.t("messagesList.ventana24h")}</span>
        </div>
      )}
      
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

// Memoizar o componente para evitar re-renderizações desnecessárias
export default React.memo(MessagesList);
