import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import ChatIcon from '@material-ui/icons/Chat';

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";

import { TicketsContext } from "../../context/Tickets/TicketsContext";

import { i18n } from "../../translate/i18n";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";

const useStyles = makeStyles(theme => ({
    header: {
        // La barra de pestanas se apoyaba en el fondo del Paper y no se
        // distinguia del contenido. Un borde inferior la separa sin recurrir
        // a una sombra, que sobre movil solo ensucia.
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    content: {
        overflow: "auto",
        backgroundColor: theme.palette.tokens.surface.background,
    },
    placeholderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: theme.palette.tokens.space.lg,
        padding: theme.palette.tokens.space.xl,
        textAlign: "center",
        background: theme.palette.tokens.surface.background,
    },
    placeholderItem: {
        // El mensaje de "ningun ticket seleccionado" no tenia tratamiento:
        // heredaba el tamano y el color del contenedor.
        color: theme.palette.tokens.text.secondary,
        fontSize: "0.9375rem",
        lineHeight: 1.5,
        maxWidth: "32ch",
    }
}));

const TicketAdvanced = (props) => {
    const classes = useStyles();
    const { ticketId } = useParams();
    const [option, setOption] = useState(0);
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)

    useEffect(() => {
        if (currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (currentTicket.id !== null) {
            setOption(0)
        }
    }, [currentTicket])

    // Sin conversacion abierta, lo util es la lista.
    //
    // La comprobacion se hacia solo al montar la pantalla, asi que al volver
    // atras desde una conversacion —la flecha de la cabecera lleva a /tickets,
    // sin desmontar esto— el movil se quedaba en la pestana de conversacion
    // mostrando "selecciona un ticket" y un boton para ir a la lista, que es
    // justo lo que se acababa de pedir.
    useEffect(() => {
        if (!ticketId || ticketId === "undefined") {
            setOption(1)
        }
    }, [ticketId])

    const renderPlaceholder = () => {
        return <Box className={classes.placeholderContainer}>
            <div className={classes.placeholderItem}>{i18n.t("chat.noTicketMessage")}</div><br />
            <Button onClick={() => setOption(1)} variant="contained" color="primary">
                {i18n.t("tickets.tabs.mobile.selectTicket")}
            </Button>
        </Box>
    }

    const renderMessageContext = () => {
        if (ticketId && ticketId !== "undefined") {
            return <Ticket />
        }
        return renderPlaceholder()
    }

    const renderTicketsManagerTabs = () => {
        return <TicketsManagerTabs
        />
    }

    return (
        <QueueSelectedProvider>

            <TicketAdvancedLayout>
                <Box className={classes.header}>
                    <BottomNavigation
                        value={option}
                        onChange={(event, newValue) => {
                            setOption(newValue);
                        }}
                        showLabels
                        className={classes.root}
                    >
                        <BottomNavigationAction
                            label={i18n.t("tickets.tabs.mobile.conversation")}
                            icon={<ChatIcon />}
                        />
                        <BottomNavigationAction
                            label={i18n.t("tickets.tabs.mobile.list")}
                            icon={<QuestionAnswerIcon />}
                        />
                    </BottomNavigation>
                </Box>
                <Box className={classes.content}>
                    {option === 0 ? renderMessageContext() : renderTicketsManagerTabs()}
                </Box>
            </TicketAdvancedLayout>
        </QueueSelectedProvider>
    );
};

export default TicketAdvanced;
