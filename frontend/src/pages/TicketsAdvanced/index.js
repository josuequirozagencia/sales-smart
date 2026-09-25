import React, { useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Box from '@material-ui/core/Box';

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";

import { TicketsContext } from "../../context/Tickets/TicketsContext";

import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";

const useStyles = makeStyles(theme => ({
    content: {
        overflow: "auto",
        backgroundColor: theme.palette.tokens.surface.background,
    },
}));

/**
 * Bandeja en movil: o la lista, o la conversacion.
 *
 * Antes lo decidia un conmutador propio arriba ("Ticket" / "Atenciones") que
 * ocupaba 44px de una pantalla donde ya se iban 229 en barras, y que ademas
 * podia contradecir a la direccion: se podia estar en la pestana de
 * conversacion sin ninguna abierta, viendo un aviso con un boton para ir a la
 * lista. Ahora manda la direccion, como en cualquier aplicacion de mensajes:
 * se toca una conversacion para abrirla y la flecha de la cabecera vuelve a la
 * lista.
 */
const TicketAdvanced = (props) => {
    const classes = useStyles();
    const { ticketId } = useParams();
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)

    const hayConversacion = ticketId && ticketId !== "undefined";

    useEffect(() => {
        if (currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <QueueSelectedProvider>
            <TicketAdvancedLayout>
                <Box className={classes.content}>
                    {hayConversacion ? <Ticket /> : <TicketsManagerTabs />}
                </Box>
            </TicketAdvancedLayout>
        </QueueSelectedProvider>
    );
};

export default TicketAdvanced;
