import React, { useState, useContext } from "react";
import { i18n } from "../../translate/i18n";
import {
    CardHeader,
    Dialog,
    DialogContent,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
// El mismo avatar que la lista de conversaciones y el panel de contacto:
// sin foto pinta las iniciales sobre un color estable del contacto, en vez
// del circulo gris de serie.
import ContactAvatar from "../ContactAvatar";
// Ya existe y ya resuelve el icono de marca por canal.
import ConnectionIcon from "../ConnectionIcon";

const useStyles = makeStyles((theme) => ({
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
    },
    // minWidth 0 en toda la cadena: sin el, un nombre largo no se recorta
    // con puntos suspensivos sino que estira la fila y empuja las acciones
    // fuera de la barra.
    cardHeader: {
        padding: theme.spacing(0.5, 1),
        minWidth: 0,
        flex: 1,
        "& .MuiCardHeader-content": {
            minWidth: 0,
        },
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: theme.palette.tokens.space.xs,
        minWidth: 0,
    },
    name: {
        fontSize: "0.9375rem",
        fontWeight: 700,
        color: theme.palette.tokens.text.primary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    // El numero de ticket es referencia, no titular: baja a gris atenuado y
    // a cifras de ancho fijo para que no baile al cambiar de conversacion.
    ticketNumber: {
        fontSize: "0.75rem",
        fontWeight: 600,
        color: theme.palette.tokens.text.muted,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
    },
    canal: {
        marginBottom: 0,
        flexShrink: 0,
    },
    subheader: {
        fontSize: "0.75rem",
        color: theme.palette.tokens.text.muted,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
    const classes = useStyles();
    const [amount, setAmount] = useState("");
    const { user } = useContext(AuthContext);
    const [imageModalOpen, setImageModalOpen] = useState(false); // Estado para o modal da imagem

    // Função para abrir modal da imagem
    const handleImageClick = (e) => {
        e.stopPropagation(); // Prevenir que o clique no avatar execute outros handlers
        if (contact?.urlPicture) {
            setImageModalOpen(true);
        }
    };

    // Função para fechar modal da imagem
    const handleImageModalClose = () => {
        setImageModalOpen(false);
    };

    const renderCardReader = () => {
        return (
            <CardHeader
                className={classes.cardHeader}
                onClick={onClick}
                style={{ cursor: "pointer" }}
                disableTypography
                avatar={
                    <ContactAvatar
                        contact={contact}
                        size={40}
                        className={classes.clickableAvatar}
                        onClick={handleImageClick}
                    />
                }
                title={
                    <div className={classes.titleRow}>
                        <span className={classes.name}>
                            {contact?.name || i18n.t("ticketInfo.noContact")}
                        </span>
                        {ticket?.channel && (
                            <ConnectionIcon
                                connectionType={ticket.channel}
                                className={classes.canal}
                                style={{ marginBottom: 0 }}
                            />
                        )}
                        {ticket?.id && (
                            <span className={classes.ticketNumber}>#{ticket.id}</span>
                        )}
                    </div>
                }
                subheader={
                    <div className={classes.subheader}>
                        {[
                            ticket?.queue?.name,
                            ticket?.user &&
                                `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`,
                            contact?.contactWallets && contact.contactWallets.length > 0
                                ? `${i18n.t("wallets.wallet")}: ${contact.contactWallets[0].wallet?.name || "N/A"}`
                                : null,
                        ].filter(Boolean).join(" · ")}
                    </div>
                }
            />
        );
    }

    const handleChange = (event) => {
        const value = event.target.value;
        setAmount(value);
    }

    return (
        <React.Fragment>
            {/* Antes iba dentro de un Grid con xs={6} y spacing={10}: la
                cabecera se quedaba en media barra y el espaciado metia 80px
                de margenes negativos. Ahora ocupa lo que le toca y el nombre
                se recorta con puntos suspensivos si no cabe. */}
            {renderCardReader()}

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
        </React.Fragment>
    );
};

export default TicketInfo;