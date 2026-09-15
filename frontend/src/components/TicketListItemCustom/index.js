import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { green, grey } from "@material-ui/core/colors";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import ContactAvatar from "../ContactAvatar";
import { List, Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import GroupIcon from "@material-ui/icons/Group";
import ContactTag from "../ContactTag";
import ConnectionIcon from "../ConnectionIcon";
import AcceptTicketWithouSelectQueue from "../AcceptTicketWithoutQueueModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ShowTicketOpen from "../ShowTicketOpenModal";
import FinalizacaoVendaModal from "../FinalizacaoVendaModal";
import { isNil } from "lodash";
import { toast } from "react-toastify";
import { Done, HighlightOff, Replay, SwapHoriz } from "@material-ui/icons";
import VisibilityIcon from "@material-ui/icons/Visibility"; // Ícone de spy
import useCompanySettings from "../../hooks/useSettings/companySettings";
import {
  Badge,
  ListItemAvatar,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  DialogContent,
} from "@material-ui/core";

import TicketWaitTimer from "../TicketWaitTimer";

const useStyles = makeStyles((theme) => ({
  ticket: {
    position: "relative",
    transition: "background-color 180ms ease",

    // Hover. Un velo tenue en vez de un cambio de color: funciona igual en
    // claro y en oscuro, y no compite con el estado seleccionado.
    "&:hover": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(15, 23, 42, 0.035)"
          : "rgba(255, 255, 255, 0.045)",
    },

    // Seleccionado. Antes se distinguia solo por el gris de serie del MUI,
    // que sobre una lista larga no se localiza de un vistazo.
    //
    // Ahora lleva superficie tintada de marca mas una barra lateral: dos
    // senales en vez de una, y la barra sigue siendo visible aunque el
    // cliente configure un primario de bajo contraste.
    "&.Mui-selected": {
      backgroundColor:
        theme.mode === "light"
          ? `${theme.palette.primary.main}14`
          : `${theme.palette.primary.main}26`,
      "&:hover": {
        backgroundColor:
          theme.mode === "light"
            ? `${theme.palette.primary.main}1f`
            : `${theme.palette.primary.main}33`,
      },
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: theme.palette.primary.main,
      },
    },
  },

  pendingTicket: {
    cursor: "unset",
  },
  queueTag: {
    // El fondo casi blanco y el texto negro estaban fijos: en modo oscuro
    // era una pastilla blanca que saltaba a la vista sin motivo.
    background: theme.palette.tokens.surface.surfaceSecondary,
    color: theme.palette.tokens.text.secondary,
    marginRight: theme.palette.tokens.space.xs,
    padding: "2px 6px",
    fontWeight: 600,
    borderRadius: theme.palette.tokens.radius.sm,
    // 0.5em daban 7px reales, por debajo de cualquier tamano legible.
    fontSize: "0.6875rem",
    whiteSpace: "nowrap",
  },
  noTicketsDiv: {
    display: "flex",
    height: "100px",
    margin: 40,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  newMessagesCount: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    top: 0,
    color: "green",
    fontWeight: "bold",
    marginRight: "10px",
    borderRadius: 0,
  },
  noTicketsText: {
    textAlign: "center",
    color: "rgb(104, 121, 146)",
    fontSize: "14px",
    lineHeight: "1.4",
  },
  connectionTag: {
    // Eran la palabra "green" de CSS y blanco fijo. El verde del sistema
    // con onColor() encima da 5.42 en vez de los 2.98 de antes.
    background: theme.palette.tokens.semantic.success.fill,
    color: theme.palette.tokens.onColor(
      theme.palette.tokens.semantic.success.fill
    ),
    marginRight: 1,
    // 0.6em herdava do body2 (14px), dando 8.4px reais — metade do texto
    // normal. Numa lista onde se passa o dia, era ilegivel. 0.6875rem = 11px,
    // agora em rem para respeitar o tamanho de letra escolhido pelo utilizador.
    //
    // O padding e o rem alargam a insignia ~30%. Medido antes de mudar: as tres
    // insignias ocupavam 104px de 435px disponiveis no item, portanto ha folga
    // de sobra e nao ha risco de transbordar.
    padding: "2px 6px",
    fontWeight: "bold",
    borderRadius: 4,
    fontSize: "0.6875rem",
    letterSpacing: "0.02em",
  },
  noTicketsTitle: {
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0px",
  },

  contactNameWrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: theme.palette.tokens.space.sm,
    marginLeft: theme.palette.tokens.space.xs,
    // 700 en vez de "bold": el nombre es el ancla de la fila y conviene
    // fijar el peso, no dejarlo a lo que interprete cada tipografia.
    fontWeight: 700,
    // Era negro y blanco literales. El token se adapta al modo y respeta
    // el contraste que ya esta medido en el sistema.
    color: theme.palette.tokens.text.primary,
  },

  lastMessageTime: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    top: -30,
    marginRight: "1px",
    // La hora es dato de apoyo, no titular: baja al gris atenuado y a 11px.
    // En claro estaba en negro puro, al mismo peso visual que el nombre.
    color: theme.palette.tokens.text.muted,
    fontSize: "0.6875rem",
    // Cifras de ancho fijo: sin esto la lista "baila" al pasar de 09:59 a
    // 10:00, porque el 1 ocupa menos que el 0 en la mayoria de tipografias.
    fontVariantNumeric: "tabular-nums",
  },

  lastMessageTimeUnread: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    top: -30,
    // Mesmo verde do badge de não lidas. Antes era o verde do CSS (#008000),
    // diferente do green[500] do badge logo ao lado.
    // green[600] dava contraste 3.30 sobre o fundo claro, abaixo dos 4.5.
    // green[800] sobe para 5.13. No modo escuro o problema e o inverso — um
    // verde escuro desaparece — dai o green[400].
    color: theme.mode === "light" ? green[800] : green[400],
    fontWeight: 600,
    marginRight: "1px",
    fontSize: "0.6875rem",
    fontVariantNumeric: "tabular-nums",
  },

  closedBadge: {
    alignSelf: "center",
    justifySelf: "flex-end",
    marginRight: 32,
    marginLeft: "auto",
  },

  // Lido e não lido diferiam só pelo negrito, e com a mesma cor — que ainda
  // por cima era sempre cinza claro por causa do theme.mode inexistente.
  // Numa lista longa, negrito sozinho não separa nada.
  //
  // Agora a hierarquia é a mesma que WhatsApp e Gmail usam: o que já foi
  // lido recua para a cor secundária, e o não lido fica na cor principal,
  // em negrito. A diferença de peso soma-se à de contraste.
  contactLastMessage: {
    paddingRight: "0%",
    marginLeft: "5px",
    color: theme.palette.text.secondary,
  },

  contactLastMessageUnread: {
    paddingRight: 20,
    fontWeight: 600,
    color: theme.palette.text.primary,
    // A largura fixa de 50% cortava a pré-visualização num ponto diferente
    // da versão lida, fazendo a lista "saltar" ao marcar como lida.
    marginLeft: "5px",
  },

  badgeStyle: {
    // El badge de mensajes sin leer usaba green[500] con texto blanco fijo:
    // ~2.98 de contraste, por debajo del minimo de 4.5. Se cambia al verde de
    // exito del sistema de tokens, con el mismo criterio de onColor que ya
    // usan las insignias de conexion/cola/agente y ContactTag mas arriba.
    color: theme.palette.tokens.onColor(theme.palette.tokens.semantic.success.fill),
    backgroundColor: theme.palette.tokens.semantic.success.fill,
  },

  acceptButton: {
    position: "absolute",
    right: "1px",
  },

  ticketQueueColor: {
    flex: "none",
    height: "100%",
    position: "absolute",
    top: "0%",
    left: "0%",
  },

  ticketInfo: {
    position: "relative",
    top: -13,
  },
  secondaryContentSecond: {
    display: "flex",
    alignItems: "center",
    // "nowrap" obligaba a las insignias a caber en una sola linea pasara lo
    // que pasara: al estrechar la ventana se salian del item en vez de
    // reacomodarse. Con "wrap" bajan a la linea siguiente, que es lo que
    // hace falta cuando un ticket lleva conexion, cola, usuario, etiquetas
    // y ahora tambien el tiempo de espera.
    flexWrap: "wrap",
    flexDirection: "row",
    alignContent: "flex-start",
    // Separacion propia en vez de los marginRight de 1px de cada insignia,
    // que las dejaban pegadas entre si.
    gap: 3,
  },
  ticketInfo1: {
    position: "relative",
    top: 13,
    right: 0,
  },
  Radiusdot: {
    "& .MuiBadge-badge": {
      borderRadius: 2,
      position: "inherit",
      height: 16,
      margin: 2,
      padding: 3,
    },
    "& .MuiBadge-anchorOriginTopRightRectangle": {
      transform: "scale(1) translate(0%, -40%)",
    },
  },
  connectionIcon: {
    marginRight: theme.spacing(1),
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
  clickableAvatar: {
    cursor: "pointer",
    "&:hover": {
      opacity: 0.8,
    },
  }
}));

const TicketListItemCustom = ({ setTabOpen, ticket }) => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [
    acceptTicketWithouSelectQueueOpen,
    setAcceptTicketWithouSelectQueueOpen,
  ] = useState(false);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");

  // Estados para o modal de finalização de venda
  const [openFinalizacaoVenda, setOpenFinalizacaoVenda] = useState(false);
  const [finalizacaoTipo, setFinalizacaoTipo] = useState(null);
  const [ticketDataToFinalize, setTicketDataToFinalize] = useState(null);
  const [showFinalizacaoOptions, setShowFinalizacaoOptions] = useState(false);

  const [imageModalOpen, setImageModalOpen] = useState(false); // Estado para o modal da imagem

  const { ticketId } = useParams();
  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);

  const { get: getSetting } = useCompanySettings();

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Função para abrir modal da imagem
  const handleImageClick = (e) => {
    e.stopPropagation(); // Prevenir que o clique no avatar selecione o ticket
    if (ticket?.contact?.urlPicture) {
      setImageModalOpen(true);
    }
  };

  // Função para fechar modal da imagem
  const handleImageModalClose = () => {
    setImageModalOpen(false);
  };

  const handleOpenAcceptTicketWithouSelectQueue = useCallback(() => {
    setAcceptTicketWithouSelectQueueOpen(true);
  }, []);

  const handleCloseTicket = async (id) => {
    // Verificar se a finalização com valor de venda está ativa
    if (
      user.finalizacaoComValorVendaAtiva === true ||
      user.finalizacaoComValorVendaAtiva === "true"
    ) {
      // Se estiver ativa, abrir o modal de finalização de venda
      setFinalizacaoTipo("comDespedida");
      setOpenFinalizacaoVenda(true);
      handleSelectTicket(ticket);
      history.push(`/tickets/${ticket.uuid}`);
    } else {
      // Comportamento original
      const setting = await getSetting({
        column: "requiredTag",
      });

      if (setting.requiredTag === "enabled") {
        //verificar se tem uma tag
        try {
          const contactTags = await api.get(
            `/contactTags/${ticket.contact.id}`
          );
          if (!contactTags.data.tags) {
            toast.warning(i18n.t("messagesList.header.buttons.requiredTag"));
          } else {
            await api.put(`/tickets/${id}`, {
              status: "closed",
              userId: user?.id || null,
            });

            if (isMounted.current) {
              setLoading(false);
            }

            history.push(`/tickets/`);
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      } else {
        setLoading(true);
        try {
          await api.put(`/tickets/${id}`, {
            status: "closed",
            userId: user?.id || null,
          });
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
        if (isMounted.current) {
          setLoading(false);
        }

        history.push(`/tickets/`);
      }
    }
  };

  const handleCloseIgnoreTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        userId: user?.id || null,
        sendFarewellMessage: false,
        amountUsedBotQueues: 0,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }

    history.push(`/tickets/`);
  };

  const truncate = (str, len) => {
    if (!isNil(str)) {
      if (str.length > len) {
        return str.substring(0, len) + "...";
      }
      return str;
    }
  };

  const handleCloseTransferTicketModal = useCallback(() => {
    if (isMounted.current) {
      setTransferTicketModalOpen(false);
    }
  }, []);

  const handleOpenTransferModal = () => {
    setLoading(true);
    setTransferTicketModalOpen(true);
    if (isMounted.current) {
      setLoading(false);
    }
    handleSelectTicket(ticket);
    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      const otherTicket = await api.put(`/tickets/${id}`, {
        status:
          ticket.isGroup && ticket.channel === "whatsapp" ? "group" : "open",
        userId: user?.id,
      });

      if (otherTicket.data.id !== ticket.id) {
        if (otherTicket.data.userId !== user?.id) {
          setOpenAlert(true);
          setUserTicketOpen(otherTicket.data.user.name);
          setQueueTicketOpen(otherTicket.data.queue.name);
        } else {
          setLoading(false);
          setTabOpen(ticket.isGroup ? "group" : "open");
          handleSelectTicket(otherTicket.data);
          history.push(`/tickets/${otherTicket.uuid}`);
        }
      } else {
        let setting;

        try {
          setting = await getSetting({
            column: "sendGreetingAccepted",
          });
        } catch (err) {
          toastError(err);
        }

        if (
          setting.sendGreetingAccepted === "enabled" &&
          (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
        ) {
          handleSendMessage(ticket.id);
        }
        if (isMounted.current) {
          setLoading(false);
        }

        setTabOpen(ticket.isGroup ? "group" : "open");
        handleSelectTicket(ticket);
        history.push(`/tickets/${ticket.uuid}`);
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  const handleSendMessage = async (id) => {
    let setting;

    try {
      setting = await getSetting({
        column: "greetingAcceptedMessage",
      });
    } catch (err) {
      toastError(err);
    }
    if (!setting.greetingAcceptedMessage) {
      toast.warning(
        i18n.t("messagesList.header.buttons.greetingAcceptedMessage")
      );
      return;
    }
    const msg = `${setting.greetingAcceptedMessage}`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `${msg.trim()}`,
    };
    try {
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleCloseAlert = useCallback(() => {
    setOpenAlert(false);
    setLoading(false);
  }, []);

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleUpdateTicketStatusWithData = async (
    ticketData,
    sendFarewellMessage,
    finalizacaoMessage
  ) => {
    try {
      await api.put(`/tickets/${ticket.id}`, {
        ...ticketData,
        sendFarewellMessage,
        finalizacaoMessage,
      });
      toast.success("Ticket finalizado com sucesso!");
      history.push(`/tickets/`);
    } catch (err) {
      toastError(err);
    }
  };

  // Função para espionar ticket chatbot
  const handleSpyTicket = () => {
    handleSelectTicket(ticket);
    history.push(`/tickets/${ticket.uuid}`);
  };

  // Lógica de permissão para mensagens pending - MOVIDA PARA DEPOIS DE TODAS AS FUNÇÕES
  const shouldBlurMessages = ticket.status === "pending" && user?.allowSeeMessagesInPendingTickets === "disabled";

  // Função para renderizar a mensagem com base na permissão - MOVIDA PARA DEPOIS DE TODAS AS FUNÇÕES
  const renderLastMessage = () => {
    if (shouldBlurMessages) {
      return (
        <MarkdownWrapper>
          {i18n.t("tickets.messageHidden") || "Mensagem oculta"}
        </MarkdownWrapper>
      );
    }

    if (!ticket.lastMessage) {
      return <br />;
    }

    if (ticket.lastMessage.includes("data:image/png;base64")) {
      return <MarkdownWrapper>{i18n.t("chat2.location")}</MarkdownWrapper>;
    }

    if (ticket.lastMessage.includes("BEGIN:VCARD")) {
      return <MarkdownWrapper>{i18n.t("chat2.contact")}</MarkdownWrapper>;
    }

    // O backend grava a palavra "Áudio" no corpo da mensagem quando chega um
    // áudio (wbotMessageListener), então o texto vem do banco já em português
    // e traduzi-lo lá só afetaria mensagens novas — além de gravar um idioma
    // dentro dos dados. Traduzir na exibição cobre também o histórico.
    if (ticket.lastMessage.trim() === "Áudio") {
      return <MarkdownWrapper>{i18n.t("chat2.audio")}</MarkdownWrapper>;
    }

    return (
      <MarkdownWrapper>
        {truncate(ticket.lastMessage, 40)}
      </MarkdownWrapper>
    );
  };

  // Franja de color a la izquierda de la fila, del mismo color que la
  // primera etiqueta del ticket (o, si no tiene, la del contacto). Es una
  // segunda lectura del estado sin tener que leer las insignias de texto:
  // se ve el color de un vistazo, igual que la barra de "seleccionado" que
  // ya existe en classes.ticket.
  //
  // Cuando el ticket esta seleccionado, la barra de seleccion (el primario
  // de marca, vía classes.ticket) ya cumple ese papel, asi que la franja de
  // etiqueta se omite ahi para no competir con ella.
  const isSelected = Boolean(ticketId && ticketId === ticket.uuid);
  const stripeColor =
    ticket.tags?.[0]?.color || ticket.contact?.tags?.[0]?.color || null;

  return (
    <React.Fragment key={ticket.id}>
      {openAlert && (
        <ShowTicketOpen
          isOpen={openAlert}
          handleClose={handleCloseAlert}
          user={userTicketOpen}
          queue={queueTicketOpen}
        />
      )}
      {acceptTicketWithouSelectQueueOpen && (
        <AcceptTicketWithouSelectQueue
          modalOpen={acceptTicketWithouSelectQueueOpen}
          onClose={(e) => setAcceptTicketWithouSelectQueueOpen(false)}
          ticketId={ticket.id}
          ticket={ticket}
        />
      )}
      {transferTicketModalOpen && (
        <TransferTicketModalCustom
          modalOpen={transferTicketModalOpen}
          onClose={handleCloseTransferTicketModal}
          ticketid={ticket.id}
          ticket={ticket}
        />
      )}
      <ListItem
        button
        dense
        onClick={(e) => {
          console.log("e", e);
          const isCheckboxClicked =
            (e.target.tagName.toLowerCase() === "input" &&
              e.target.type === "checkbox") ||
            (e.target.tagName.toLowerCase() === "svg" &&
              e.target.type === undefined) ||
            (e.target.tagName.toLowerCase() === "path" &&
              e.target.type === undefined);

          if (isCheckboxClicked) return;

          handleSelectTicket(ticket);
        }}
        selected={isSelected}
        className={clsx(classes.ticket, {
          [classes.pendingTicket]: ticket.status === "pending",
        })}
      >
        {stripeColor && !isSelected && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: stripeColor,
            }}
          />
        )}
        {/* Tenia marginLeft -15px sobre el relleno de 16 del elemento: el circulo
            quedaba a 1px del borde, encima de la barra de color de 3px. Ahora
            queda a 12px, y pasa de 50 a 42px; el hueco hasta el texto se ajusta
            para no quitarle ancho a la conversacion. */}
        <ListItemAvatar style={{ marginLeft: -4, minWidth: 52 }}>
          {/* Sin foto sale un circulo de color con las iniciales, y no el
              icono generico de persona que pintaba MUI: era el mismo para
              todos los contactos, asi que no ayudaba a distinguirlos. El
              color va por contacto y es siempre el mismo. */}
          <ContactAvatar
            contact={ticket?.contact}
            size={42}
            className={classes.clickableAvatar}
            onClick={handleImageClick}
          />
        </ListItemAvatar>
        <ListItemText
          disableTypography
          primary={
            <span className={classes.contactNameWrapper}>
              <Typography
                noWrap
                component="span"
                variant="body2"
              >
                {ticket.isGroup && ticket.channel === "whatsapp" && (
                  <GroupIcon
                    fontSize="small"
                    style={{
                      color: grey[700],
                      marginBottom: "-1px",
                      marginLeft: "5px",
                    }}
                  />
                )}{" "}
                &nbsp;
                {ticket.channel && (
                  <ConnectionIcon
                    width="20"
                    height="20"
                    className={classes.connectionIcon}
                    connectionType={ticket.channel}
                  />
                )}{" "}
                &nbsp;
                {truncate(ticket.contact?.name, 60)}
              </Typography>
            </span>
          }
          secondary={
            <span className={classes.contactNameWrapper}>
              <Typography
                className={
                  Number(ticket.unreadMessages) > 0
                    ? classes.contactLastMessageUnread
                    : classes.contactLastMessage
                }
                noWrap
                component="span"
                variant="body2"
              >
                {renderLastMessage()}
                <span className={classes.secondaryContentSecond}>
                  {/* Cuanto lleva el cliente esperando respuesta.

                      Va aqui, con las demas insignias, y no en el carril
                      derecho: alli conviven DOS ListItemSecondaryAction que
                      MUI posiciona en absoluto contra el mismo borde, asi
                      que cualquier cosa que se anada se monta sobre los
                      iconos. Aqui es flujo normal y se reordena solo al
                      estrechar la ventana.

                      Va primero porque es la senal mas urgente de la fila. */}
                  <TicketWaitTimer
                    waitingSince={ticket.waitingSince}
                    queue={ticket.queue}
                  />
                  {ticket?.whatsapp ? (
                    <Badge
                      className={classes.connectionTag}
                      style={(() => {
                        // El fondo lo decide el color guardado de la conexion,
                        // que se escribe a mano en la ficha. El texto era blanco
                        // fijo, asi que una conexion de color claro daba
                        // combinaciones ilegibles: la de esta instalacion,
                        // #26E697, quedaba en 1.63 de contraste.
                        //
                        // onColor elige blanco o tinta oscura segun el fondo, con
                        // el mismo criterio que aplica MUI en contrastText.
                        const fondo =
                          ticket.channel === "whatsapp"
                            ? ticket.whatsapp?.color || "#25D366"
                            : ticket.channel === "facebook"
                            ? "#4267B2"
                            : "#E1306C";
                        return {
                          backgroundColor: fondo,
                          color: theme.palette.tokens.onColor(fondo),
                        };
                      })()}
                    >
                      {ticket.whatsapp?.name.toUpperCase()}
                    </Badge>
                  ) : (
                    <br></br>
                  )}
                  {
                    <Badge
                      style={(() => {
                        // Mismo caso: el color de la cola se elige en Colas.
                        const fondo = ticket.queue?.color || "#7c7c7c";
                        return {
                          backgroundColor: fondo,
                          color: theme.palette.tokens.onColor(fondo),
                        };
                      })()}
                      className={classes.connectionTag}
                    >
                      {ticket.queueId
                        ? ticket.queue?.name.toUpperCase()
                        : ticket.status === "lgpd"
                        ? "LGPD"
                        : `${i18n.t("momentsUser.noqueue")}`}
                    </Badge>
                  }
                  {ticket?.user && (
                    <Badge
                      style={{
                        backgroundColor: theme.palette.tokens.text.primary,
                        color: theme.palette.tokens.onColor(
                          theme.palette.tokens.text.primary
                        ),
                      }}
                      className={classes.connectionTag}
                    >
                      {ticket.user?.name.toUpperCase()}
                    </Badge>
                  )}
                </span>
                <span className={classes.secondaryContentSecond}>
                  {ticket?.contact?.tags?.map((tag) => {
                    return (
                      <ContactTag
                        tag={tag}
                        key={`ticket-contact-tag-${ticket.id}-${tag.id}`}
                      />
                    );
                  })}
                </span>
                <span className={classes.secondaryContentSecond}>
                  {ticket.tags?.map((tag) => {
                    return (
                      <ContactTag
                        tag={tag}
                        key={`ticket-contact-tag-${ticket.id}-${tag.id}`}
                      />
                    );
                  })}
                </span>
              </Typography>

              <Badge
                className={classes.newMessagesCount}
                badgeContent={shouldBlurMessages ? "?" : ticket.unreadMessages}
                classes={{
                  badge: classes.badgeStyle,
                }}
              />
            </span>
          }
        />
        <ListItemSecondaryAction>
          {ticket.lastMessage && (
            <>
              <Typography
                className={
                  Number(ticket.unreadMessages) > 0
                    ? classes.lastMessageTimeUnread
                    : classes.lastMessageTime
                }
                component="span"
                variant="body2"
              >
                {isSameDay(parseISO(ticket.updatedAt), new Date()) ? (
                  <>{format(parseISO(ticket.updatedAt), "HH:mm")}</>
                ) : (
                  <>{format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}</>
                )}
              </Typography>
            </>
          )}
        </ListItemSecondaryAction>
        <ListItemSecondaryAction>
          {/* Para tickets com status chatbot, mostrar apenas o ícone de spy */}
          {ticket.status === "chatbot" && (
            <span className={classes.secondaryContentSecond}>
              <ButtonWithSpinner
                style={{
                  backgroundColor: "transparent",
                  boxShadow: "none",
                  border: "none",
                  color: theme.mode === "light" ? "blue" : "#FFF",
                  padding: "0px",
                  borderRadius: "50%",
                  right: "1px",
                  fontSize: "0.6rem",
                  bottom: "-30px",
                  minWidth: "2em",
                  width: "auto",
                }}
                variant="contained"
                className={classes.acceptButton}
                size="small"
                loading={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpyTicket();
                }}
              >
                <Tooltip title="Espiar conversa do chatbot">
                  <VisibilityIcon />
                </Tooltip>
              </ButtonWithSpinner>
            </span>
          )}

          {/* Para todos os outros status, manter os botões originais */}
          {ticket.status !== "chatbot" && (
            <>
              <span className={classes.secondaryContentSecond}>
                {ticket.status === "pending" &&
                  (ticket.queueId === null || ticket.queueId === undefined) && (
                    <ButtonWithSpinner
                      style={{
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        border: "none",
                        color: theme.mode === "light" ? "green" : "#FFF",
                        padding: "0px",
                        borderRadius: "50%",
                        right: "51px",
                        fontSize: "0.6rem",
                        bottom: "-30px",
                        minWidth: "2em",
                        width: "auto",
                      }}
                      variant="contained"
                      className={classes.acceptButton}
                      size="small"
                      loading={loading}
                      onClick={(e) => handleOpenAcceptTicketWithouSelectQueue()}
                    >
                      <Tooltip title={`${i18n.t("ticketsList.buttons.accept")}`}>
                        <Done />
                      </Tooltip>
                    </ButtonWithSpinner>
                  )}
              </span>
              <span className={classes.secondaryContentSecond}>
                {ticket.status === "pending" && ticket.queueId !== null && (
                  <ButtonWithSpinner
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      border: "none",
                      color: theme.mode === "light" ? "green" : "#FFF",
                      padding: "0px",
                      borderRadius: "50%",
                      right: "51px",
                      fontSize: "0.6rem",
                      bottom: "-30px",
                      minWidth: "2em",
                      width: "auto",
                    }}
                    variant="contained"
                    className={classes.acceptButton}
                    size="small"
                    loading={loading}
                    onClick={(e) => handleAcepptTicket(ticket.id)}
                  >
                    <Tooltip title={`${i18n.t("ticketsList.buttons.accept")}`}>
                      <Done />
                    </Tooltip>
                  </ButtonWithSpinner>
                )}
              </span>
              <span className={classes.secondaryContentSecond1}>
                {(ticket.status === "pending" ||
                  ticket.status === "open" ||
                  ticket.status === "group") && (
                  <ButtonWithSpinner
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      border: "none",
                      color: theme.mode === "light" ? "purple" : "#FFF",
                      padding: "0px",
                      borderRadius: "50%",
                      right: "26px",
                      position: "absolute",
                      fontSize: "0.6rem",
                      bottom: "-30px",
                      minWidth: "2em",
                      width: "auto",
                    }}
                    variant="contained"
                    className={classes.acceptButton}
                    size="small"
                    loading={loading}
                    onClick={handleOpenTransferModal}
                  >
                    <Tooltip title={`${i18n.t("ticketsList.buttons.transfer")}`}>
                      <SwapHoriz />
                    </Tooltip>
                  </ButtonWithSpinner>
                )}
              </span>
              <span className={classes.secondaryContentSecond}>
                {(ticket.status === "open" || ticket.status === "group") && (
                  <ButtonWithSpinner
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      border: "none",
                      color: theme.mode === "light" ? "red" : "#FFF",
                      padding: "0px",
                      bottom: "0px",
                      borderRadius: "50%",
                      right: "1px",
                      fontSize: "0.6rem",
                      bottom: "-30px",
                      minWidth: "2em",
                      width: "auto",
                    }}
                    variant="contained"
                    className={classes.acceptButton}
                    size="small"
                    loading={loading}
                    onClick={(e) => handleCloseTicket(ticket.id)}
                  >
                    <Tooltip title={`${i18n.t("ticketsList.buttons.closed")}`}>
                      <HighlightOff />
                    </Tooltip>
                  </ButtonWithSpinner>
                )}
              </span>
              <span className={classes.secondaryContentSecond}>
                {(ticket.status === "pending" || ticket.status === "lgpd") &&
                  (user.userClosePendingTicket === "enabled" ||
                    user.profile === "admin") && (
                    <ButtonWithSpinner
                      style={{
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        border: "none",
                        color: theme.mode === "light" ? "red" : "#FFF",
                        padding: "0px",
                        bottom: "0px",
                        borderRadius: "50%",
                        right: "1px",
                        fontSize: "0.6rem",
                        bottom: "-30px",
                        minWidth: "2em",
                        width: "auto",
                      }}
                      variant="contained"
                      className={classes.acceptButton}
                      size="small"
                      loading={loading}
                      onClick={(e) => handleCloseIgnoreTicket(ticket.id)}
                    >
                      <Tooltip title={`${i18n.t("ticketsList.buttons.ignore")}`}>
                        <HighlightOff />
                      </Tooltip>
                    </ButtonWithSpinner>
                  )}
              </span>
              <span className={classes.secondaryContentSecond}>
                {ticket.status === "closed" &&
                  (ticket.queueId === null || ticket.queueId === undefined) && (
                    <ButtonWithSpinner
                      style={{
                        backgroundColor: "transparent",
                        boxShadow: "none",
                        border: "none",
                        color: theme.mode === "light" ? "orange" : "#FFF",
                        padding: "0px",
                        bottom: "0px",
                        borderRadius: "50%",
                        right: "1px",
                        fontSize: "0.6rem",
                        bottom: "-30px",
                        minWidth: "2em",
                        width: "auto",
                      }}
                      variant="contained"
                      className={classes.acceptButton}
                      size="small"
                      loading={loading}
                      onClick={(e) => handleOpenAcceptTicketWithouSelectQueue()}
                    >
                      <Tooltip title={`${i18n.t("ticketsList.buttons.reopen")}`}>
                        <Replay />
                      </Tooltip>
                    </ButtonWithSpinner>
                  )}
              </span>
              <span className={classes.secondaryContentSecond}>
                {ticket.status === "closed" && ticket.queueId !== null && (
                  <ButtonWithSpinner
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      border: "none",
                      color: theme.mode === "light" ? "orange" : "#FFF",
                      padding: "0px",
                      bottom: "0px",
                      borderRadius: "50%",
                      right: "1px",
                      fontSize: "0.6rem",
                      bottom: "-30px",
                      minWidth: "2em",
                      width: "auto",
                    }}
                    variant="contained"
                    className={classes.acceptButton}
                    size="small"
                    loading={loading}
                    onClick={(e) => handleAcepptTicket(ticket.id)}
                  >
                    <Tooltip title={`${i18n.t("ticketsList.buttons.reopen")}`}>
                      <Replay />
                    </Tooltip>
                  </ButtonWithSpinner>
                )}
              </span>
            </>
          )}
        </ListItemSecondaryAction>
      </ListItem>

      {/* Modal de Finalização de Venda */}
      {openFinalizacaoVenda && (
        <FinalizacaoVendaModal
          open={openFinalizacaoVenda}
          onClose={() => setOpenFinalizacaoVenda(false)}
          ticket={ticket}
          onFinalizar={(ticketData) => {
            setOpenFinalizacaoVenda(false);
            setTicketDataToFinalize(ticketData);
            setShowFinalizacaoOptions(true);
          }}
        />
      )}

      {/* Modal de Opções de Finalização */}
      {showFinalizacaoOptions && (
        <Dialog
          open={showFinalizacaoOptions}
          onClose={() => setShowFinalizacaoOptions(false)}
          aria-labelledby="finalizacao-options-title"
        >
          <DialogTitle id="finalizacao-options-title">
            Como deseja finalizar?
          </DialogTitle>
          <DialogActions>
            <Button
              onClick={async () => {
                setShowFinalizacaoOptions(false);
                await handleUpdateTicketStatusWithData(
                  ticketDataToFinalize,
                  false,
                  null
                );
              }}
              style={{ background: theme.palette.primary.main, color: "white" }}
            >
              {i18n.t("messagesList.header.dialogRatingWithoutFarewellMsg")}
            </Button>
            <Button
              onClick={async () => {
                setShowFinalizacaoOptions(false);
                await handleUpdateTicketStatusWithData(
                  ticketDataToFinalize,
                  true,
                  null
                );
              }}
              style={{ background: theme.palette.primary.main, color: "white" }}
            >
              {i18n.t("messagesList.header.dialogRatingCancel")}
            </Button>
          </DialogActions>
        </Dialog>
      )}

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
            src={ticket?.contact?.urlPicture} 
            alt={ticket?.contact?.name || "Foto do contato"}
            className={classes.expandedImage}
          />
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};

// Memoizar o componente para evitar re-renderizações desnecessárias
export default React.memo(TicketListItemCustom, (prevProps, nextProps) => {
  // Comparar apenas as props que realmente importam para a renderização
  return (
    prevProps.ticket?.id === nextProps.ticket?.id &&
    prevProps.ticket?.status === nextProps.ticket?.status &&
    prevProps.ticket?.unreadMessages === nextProps.ticket?.unreadMessages &&
    prevProps.ticket?.lastMessage === nextProps.ticket?.lastMessage &&
    prevProps.ticket?.updatedAt === nextProps.ticket?.updatedAt &&
    // Sin esto la fila no se repintaria cuando el cliente vuelve a escribir
    // o el asesor contesta, y el contador de espera se quedaria clavado.
    prevProps.ticket?.waitingSince === nextProps.ticket?.waitingSince &&
    prevProps.ticket?.userId === nextProps.ticket?.userId &&
    prevProps.ticket?.contact?.name === nextProps.ticket?.contact?.name &&
    prevProps.ticket?.contact?.profilePicUrl === nextProps.ticket?.contact?.profilePicUrl &&
    prevProps.ticket?.whatsapp?.name === nextProps.ticket?.whatsapp?.name
  );
});