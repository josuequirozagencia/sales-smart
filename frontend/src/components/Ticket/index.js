import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";

import { makeStyles, useTheme, Paper, IconButton, Tooltip, useMediaQuery } from "@material-ui/core";
// Del set propio del proyecto, como el resto de esta seccion: el boton
// quedaba con un icono relleno de Material-UI entre iconos de trazo.
import { InfoOutlined as InfoOutlinedIcon } from "../Icons";

import { i18n } from "../../translate/i18n";
import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import AiAgentTicketControl from "../AiAgentTicketControl";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";

import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { isNil } from 'lodash';
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

// Si la ficha de contacto esta expandida o plegada se recuerda por navegador,
// como el tema o el volumen. Solo cuenta la columna acoplada de escritorio.
const CLAVE_FICHA_ABIERTA = "contactDrawerOpen";

const leerFichaAbierta = (porDefecto) => {
  try {
    const valor = localStorage.getItem(CLAVE_FICHA_ABIERTA);
    return valor === null ? porDefecto : valor === "true";
  } catch (err) {
    return porDefecto;
  }
};

const guardarFichaAbierta = (abierta) => {
  try {
    localStorage.setItem(CLAVE_FICHA_ABIERTA, String(abierta));
  } catch (err) {
    // Sin almacenamiento (modo privado, cuota): la ficha funciona igual,
    // solo no se recuerda al recargar.
  }
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  // Antes llevaba marginRight -320 para que, con la ficha cerrada, el hilo
  // pasara por encima del hueco del cajon. Ahora la ficha acoplada nunca se
  // cierra —plegada ocupa solo su riel— y el hilo se queda con el resto por
  // flex; superpuesta no ocupa sitio en el flujo.
  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderLeft: "0",
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);
  const { setTabOpen } = useContext(TicketsContext);
  const theme = useTheme();
  // En pantallas anchas el panel de contacto arranca visible, como una
  // columna más — en pantallas angostas (agentes en laptop) sigue
  // arrancando cerrado para no robarle espacio al chat. Se calcula una
  // sola vez al montar, no se fuerza a cada cambio de tamaño de ventana.
  const wideScreen = useMediaQuery(theme.breakpoints.up("lg"), { noSsr: true });
  // Por debajo de 960px el panel de contacto deja de ser una columna y pasa
  // a superponerse sobre el chat. Con 320px fijos empujando, un movil de 400
  // dejaba el hilo en unos 50px: tecnicamente abierto e inservible. Este si
  // reevalua al redimensionar, a diferencia del calculo de arriba, que solo
  // decide el estado inicial.
  // noSsr para que el primer render ya sepa si es superpuesto: el estado
  // inicial de la ficha depende de ello.
  const panelSuperpuesto = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  // Superpuesta arranca cerrada, para no tapar el chat al entrar. Acoplada, lo
  // que el asesor dejo la ultima vez en este navegador; si nunca lo toco,
  // abierta en pantallas anchas y plegada en las demas, como antes.
  const [drawerOpen, setDrawerOpen] = useState(() =>
    panelSuperpuesto ? false : leerFichaAbierta(wideScreen)
  );
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [dragDropFiles, setDragDropFiles] = useState([]);
  const { companyId } = user;

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {

          if (!isNil(ticketId) && ticketId !== "undefined") {

            const { data } = await api.get("/tickets/u/" + ticketId);

            setContact(data.contact);
            // setWhatsapp(data.whatsapp);
            // setQueueId(data.queueId);
            setTicket(data);
            if (["pending", "open", "group"].includes(data.status)) {
              setTabOpen(data.status);
            }
            setLoading(false);
          }
        } catch (err) {
          history.push("/tickets");   // correção para evitar tela branca uuid não encontrado Feito por Altemir 16/08/2023
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  useEffect(() => {
    if (!ticket && !ticket.id && ticket.uuid !== ticketId && ticketId === "undefined") {
      return;
    }

    if (user.companyId) {
      //    const socket = socketManager.GetSocket();

      const onConnectTicket = () => {
        socket.emit("joinChatBox", `${ticket.id}`);
      }

      const onCompanyTicket = (data) => {
        if (data.action === "update" && data.ticket.id === ticket?.id) {
          setTicket(data.ticket);
        }

        if (data.action === "delete" && data.ticketId === ticket?.id) {
          history.push("/tickets");
        }
      };

      const onCompanyContactTicket = (data) => {
        if (data.action === "update") {
          // if (isMounted) {
          setContact((prevState) => {
            if (prevState.id === data.contact?.id) {
              return { ...prevState, ...data.contact };
            }
            return prevState;
          });
          // }
        }
      };

      socket.on("connect", onConnectTicket)
      socket.on(`company-${companyId}-ticket`, onCompanyTicket);
      socket.on(`company-${companyId}-contact`, onCompanyContactTicket);

      return () => {

        socket.emit("joinChatBoxLeave", `${ticket.id}`);
        socket.off("connect", onConnectTicket);
        socket.off(`company-${companyId}-ticket`, onCompanyTicket);
        socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
      };
    }
  }, [ticketId, ticket, history]);

  const handleDrawerOpen = useCallback(() => {
    setDrawerOpen(true);
    if (!panelSuperpuesto) guardarFichaAbierta(true);
  }, [panelSuperpuesto]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    if (!panelSuperpuesto) guardarFichaAbierta(false);
  }, [panelSuperpuesto]);

  const handleQuickMessageSelect = (quickMessage) => {
    try {
      if (quickMessage.message) {
        // Disparar evento que o MessageInput vai escutar
        const event = new CustomEvent('insertQuickMessage', {
          detail: { message: quickMessage.message }
        });
        window.dispatchEvent(event);
        
      }
      
      if (quickMessage.mediaPath) {
        // Tratar mídia se necessário
      }
    } catch (error) {
      console.error("Erro ao inserir resposta rápida:", error);
      toastError("Erro ao inserir resposta rápida");
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          isGroup={ticket.isGroup}
          onDrop={setDragDropFiles}
          whatsappId={ticket.whatsappId}
          queueId={ticket.queueId}
          channel={ticket.channel}
          ticketStatus={ticket.status}
        >
        </MessagesList>
        <MessageInput
          ticketId={ticket.id}
          ticketStatus={ticket.status}
          ticketChannel={ticket.channel}
          droppedFiles={dragDropFiles}
          contactId={contact.id}
          whatsappId={ticket.whatsappId}
        />
      </>
    );
  };


  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={classes.mainWrapper}
      >
        {/* <div id="TicketHeader"> */}
        <TicketHeader loading={loading}>
          {ticket.contact !== undefined && (
            <div id="TicketHeader">
              <TicketInfo
                contact={contact}
                ticket={ticket}
                onClick={handleDrawerOpen}
              />
            </div>
          )}
        <TicketActionButtons
          ticket={ticket}
          contact={contact}
          onQuickMessageSelect={handleQuickMessageSelect}
        />
        {/* Los textos salen del diccionario: escritos a mano en castellano
            se los verian igual quien tenga la aplicacion en portugues o en
            ingles. */}
        {ticket.contact !== undefined && (
          <Tooltip
            title={
              drawerOpen
                ? i18n.t("ticketOptionsMenu.contactInfo.hide")
                : i18n.t("ticketOptionsMenu.contactInfo.show")
            }
          >
            <IconButton
              color={drawerOpen ? "primary" : "default"}
              onClick={drawerOpen ? handleDrawerClose : handleDrawerOpen}
              aria-label={i18n.t("ticketOptionsMenu.contactInfo.label")}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
        </TicketHeader>
        {/* </div> */}
        {/* Agente IA activo o pausado en esta conversacion. Independiente de la
            asignacion: solo aparece si la conexion tiene agente. */}
        <AiAgentTicketControl ticket={ticket} contact={contact} />
        <Paper>
          <TagsContainer contact={contact} />
        </Paper>
        <ReplyMessageProvider>
          <ForwardMessageProvider>
            <EditMessageProvider>
              {renderMessagesList()}
            </EditMessageProvider>
          </ForwardMessageProvider>
        </ReplyMessageProvider>
      </Paper>

      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        handleDrawerOpen={handleDrawerOpen}
        contact={contact}
        loading={loading}
        ticket={ticket}
        superpuesto={panelSuperpuesto}
      />

    </div>
  );
};

export default Ticket;