import React, { useState, useEffect, useReducer, useContext, useMemo, useCallback, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { throttle, debounce } from "../../utils/debounce";

const useStyles = makeStyles((theme) => ({
    ticketsListWrapper: {
        position: "relative",
        display: "flex",
        height: "100%",
        flexDirection: "column",
        overflow: "hidden",
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },

    ticketsList: {
        flex: 1,
        maxHeight: "100%",
        overflowY: "scroll",
        ...theme.scrollbarStyles,
        borderTop: "2px solid rgba(0, 0, 0, 0.12)",
    },

    ticketsListHeader: {
        color: "rgb(67, 83, 105)",
        zIndex: 2,
        backgroundColor: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },

    ticketsCount: {
        fontWeight: "normal",
        color: "rgb(104, 121, 146)",
        marginLeft: "8px",
        fontSize: "14px",
    },

    noTicketsText: {
        textAlign: "center",
        // Contraste medido de 4.43 sobre o fundo branco, abaixo dos 4.5 que a
        // WCAG AA exige para texto normal. A cor do tema passa e, ao contrario
        // do valor fixo, acompanha o modo claro/escuro.
        color: theme.palette.text.secondary,
        fontSize: "14px",
        lineHeight: "1.4",
    },

    noTicketsTitle: {
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "600",
        margin: "0px",
    },

    noTicketsDiv: {
        display: "flex",
        // height: "190px",
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
}));

const ticketSortAsc = (a, b) => {
    
    if (a.updatedAt < b.updatedAt) {
        return -1;
    }
    if (a.updatedAt > b.updatedAt) {
        return 1;
    }
    return 0;
}

const ticketSortDesc = (a, b) => {
   
    if (a.updatedAt > b.updatedAt) {
        return -1;
    }
    if (a.updatedAt < b.updatedAt) {
        return 1;
    }
    return 0;
}

// Marca invisible con la que el sistema prefija los mensajes del bot.
const MARCA_BOT = String.fromCharCode(8206);

/**
 * Mantiene al dia el inicio de la espera del cliente.
 *
 * El socket manda el ticket SIN waitingSince, porque ese dato lo calcula
 * ListTicketsService y no viaja en los eventos. Si aqui se sustituyera el
 * ticket sin mas, el contador desapareceria al primer evento, o —peor—
 * seguiria corriendo despues de que el asesor ya hubiera contestado.
 *
 * Se aplica la misma regla que el backend, para que las dos no discrepen:
 * solo cuenta como respuesta la de una persona, ni el bot ni las notas
 * internas.
 */
const calcularEspera = (anterior, mensaje) => {
    const previo = anterior ? anterior.waitingSince : null;

    // Un evento sin mensaje —cambio de estado, asignacion— no altera la
    // espera: se conserva la que hubiera.
    if (!mensaje) return previo || null;

    if (mensaje.fromMe) {
        const esBot =
            typeof mensaje.body === "string" && mensaje.body.includes(MARCA_BOT);
        // Respuesta de una persona: la espera termina. El bot no atiende, y
        // una nota interna el cliente no la ve.
        if (!esBot && !mensaje.isPrivate) return null;
        return previo || null;
    }

    // Mensaje del cliente: si ya estaba esperando se conserva el inicio, y
    // si no, la espera empieza con este mensaje.
    return previo || mensaje.createdAt || new Date().toISOString();
};

const reducer = (state, action) => {
    //console.log("action", action, state)
    const sortDir = action.sortDir;

    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;

        newTickets.forEach((ticket) => {
            const ticketIndex = state.findIndex((t) => t.id === ticket.id);
            if (ticketIndex !== -1) {
                state[ticketIndex] = ticket;
                if (ticket.unreadMessages > 0) {
                    state.unshift(state.splice(ticketIndex, 1)[0]);
                }
            } else {
                state.push(ticket);
            }
        });
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET_UNREAD") {
        const ticketId = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state[ticketIndex].unreadMessages = 0;
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            ticket.waitingSince = calcularEspera(state[ticketIndex], action.message);
            state[ticketIndex] = ticket;
        } else {
            state.unshift(ticket);
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            ticket.waitingSince = calcularEspera(state[ticketIndex], action.message);
            state[ticketIndex] = ticket;
            state.unshift(state.splice(ticketIndex, 1)[0]);
        } else {
            if (action.status === action.payload.status) {
                state.unshift(ticket);
            }
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_CONTACT") {
        const contact = action.payload;
        const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
        if (ticketIndex !== -1) {
            state[ticketIndex].contact = contact;
        }
        return [...state];
    }

    if (action.type === "DELETE_TICKET") {
        const ticketId = action.payload;
        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state.splice(ticketIndex, 1);
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            sortDir === 'ASC' ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const TicketsListCustom = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        selectedQueueIds,
        updateCount,
        style,
        whatsappIds,
        forceSearch,
        statusFilter,
        userFilter,
        sortTickets
    } = props;

    const classes = useStyles();
    const [pageNumber, setPageNumber] = useState(1);
    let [ticketsList, dispatch] = useReducer(reducer, []);
    //   const socketManager = useContext(SocketContext);
    const { user, socket } = useContext(AuthContext);

    const { profile, queues } = user;
    const showTicketWithoutQueue = user.allTicket === 'enable';
    const companyId = user.companyId;

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [status, searchParam, dispatch, showAll, tags, users, forceSearch, selectedQueueIds, whatsappIds, statusFilter, sortTickets, searchOnMessages]);

    const { tickets, hasMore, loading } = useTickets({
        pageNumber,
        searchParam,
        status,
        showAll,
        searchOnMessages: searchOnMessages ? "true" : "false",
        tags: JSON.stringify(tags),
        users: JSON.stringify(users),
        queueIds: JSON.stringify(selectedQueueIds),
        whatsappIds: JSON.stringify(whatsappIds),
        statusFilter: JSON.stringify(statusFilter),
        userFilter,
        sortTickets
    });


    useEffect(() => {
        // const queueIds = queues.map((q) => q.id);
        // const filteredTickets = tickets.filter(
        //     (t) => queueIds.indexOf(t.queueId) > -1
        // );
        // const allticket = user.allTicket === 'enabled';
        // if (profile === "admin" || allTicket || allowGroup || allHistoric) {
        if (companyId) {
            dispatch({
                type: "LOAD_TICKETS",
                payload: tickets,
                status,
                sortDir: sortTickets
            });
        }
        // } else {
        //  dispatch({ type: "LOAD_TICKETS", payload: filteredTickets });
        // }

    }, [tickets]);

    // Funções de validação memoizadas
    const shouldUpdateTicket = useCallback((ticket) => {
        return (!ticket?.userId || ticket?.userId === user?.id || showAll) &&
            ((!ticket?.queueId && showTicketWithoutQueue) || selectedQueueIds.indexOf(ticket?.queueId) > -1)
    }, [user?.id, showAll, showTicketWithoutQueue, selectedQueueIds]);

    const notBelongsToUserQueues = useCallback((ticket) =>
        ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1,
    [selectedQueueIds]);

    // Handlers com throttle/debounce
    const throttledDispatch = useMemo(
        () => throttle((action) => dispatch(action), 100),
        []
    );

    // Socket handlers memoizados
    const onCompanyTicketTicketsList = useCallback((data) => {
        if (data.action === "updateUnread") {
            throttledDispatch({
                type: "RESET_UNREAD",
                payload: data.ticketId,
                status: status,
                sortDir: sortTickets
            });
        }
        
        if (data.action === "update" &&
            shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
            throttledDispatch({
                type: "UPDATE_TICKET",
                payload: data.ticket,
                status: status,
                sortDir: sortTickets
            });
        }

        if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
            throttledDispatch({
                type: "DELETE_TICKET", 
                payload: data.ticket?.id, 
                status: status,
                sortDir: sortTickets
            });
        }

        if (data.action === "delete") {
            throttledDispatch({
                type: "DELETE_TICKET", 
                payload: data?.ticketId, 
                status: status,
                sortDir: sortTickets
            });
        }
    }, [shouldUpdateTicket, notBelongsToUserQueues, status, sortTickets, throttledDispatch]);

    const onCompanyAppMessageTicketsList = useCallback((data) => {
        if (data.action === "create" &&
            shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
            throttledDispatch({
                type: "UPDATE_TICKET_UNREAD_MESSAGES",
                payload: data.ticket,
                // El mensaje dice quien acaba de hablar, que es lo unico
                // que permite mantener el contador de espera al dia sin
                // volver a pedir la lista entera.
                message: data.message,
                status: status,
                sortDir: sortTickets
            });
        }
    }, [shouldUpdateTicket, status, sortTickets, throttledDispatch]);

    const onCompanyContactTicketsList = useCallback((data) => {
        if (data.action === "update" && data.contact) {
            throttledDispatch({
                type: "UPDATE_TICKET_CONTACT",
                payload: data.contact,
                status: status,
                sortDir: sortTickets
            });
        }
    }, [status, sortTickets, throttledDispatch]);

    // UseEffect apenas para gerenciar join/leave de rooms
    useEffect(() => {
        if (status) {
            socket.emit("joinTickets", status);
        } else {
            socket.emit("joinNotification");
        }

        return () => {
            if (status) {
                socket.emit("leaveTickets", status);
            } else {
                socket.emit("leaveNotification");
            }
        };
    }, [status, socket]);

    // UseEffect separado para socket listeners
    useEffect(() => {
        const onConnectTicketsList = () => {
            if (status) {
                socket.emit("joinTickets", status);
            } else {
                socket.emit("joinNotification");
            }
        }

        socket.on("connect", onConnectTicketsList)
        socket.on(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
        socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
        socket.on(`company-${companyId}-contact`, onCompanyContactTicketsList);

        return () => {
            socket.off("connect", onConnectTicketsList);
            socket.off(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
            socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
            socket.off(`company-${companyId}-contact`, onCompanyContactTicketsList);
        };
    }, [companyId, status, socket, onCompanyTicketTicketsList, onCompanyAppMessageTicketsList, onCompanyContactTicketsList]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            updateCount(ticketsList.length);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketsList]);

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    if (status && status !== "search") {
        ticketsList = ticketsList.filter(ticket => ticket.status === status)
    }

    return (
        <Paper className={classes.ticketsListWrapper} style={style}>
            <Paper
                square
                name="closed"
                elevation={0}
                className={classes.ticketsList}
                onScroll={handleScroll}
            >
                <List style={{ paddingTop: 0 }} >
                    {ticketsList.length === 0 && !loading ? (
                        <div className={classes.noTicketsDiv}>
                            <span className={classes.noTicketsTitle}>
                                {i18n.t("ticketsList.noTicketsTitle")}
                            </span>
                            <p className={classes.noTicketsText}>
                                {i18n.t("ticketsList.noTicketsMessage")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {ticketsList.map((ticket) => (
                                // <List key={ticket.id}>
                                //     {console.log(ticket)}
                                <TicketListItem
                                    ticket={ticket}
                                    key={ticket.id}
                                    setTabOpen={setTabOpen}
                                />
                                // </List>
                            ))}
                        </>
                    )}
                    {loading && <TicketsListSkeleton />}
                </List>
            </Paper>
        </Paper>
    );
};

export default React.memo(TicketsListCustom);
