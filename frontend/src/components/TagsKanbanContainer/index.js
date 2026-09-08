import { Chip, Paper, Select, MenuItem, Grid, InputLabel, FormControl } from "@material-ui/core";
import React, { useEffect, useRef, useState } from "react";
import { isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { Field, Form } from "formik";
// Chevron del set propio, en trazo, en lugar del triangulo relleno de serie.
import { ExpandMore } from "../Icons";
const useStyles = makeStyles((theme) => ({
    menuListItem: {
        paddingTop: 0,
        paddingBottom: 0,
        border: "none",
    },
    menuItem: {
        maxHeight: 30,
    },

    chips: {
        display: "flex",
        flexWrap: "wrap",
    },
    chip: {
        margin: 2,
    },
    // El selector venia con la caja de serie: esquinas de 4px, borde negro al
    // 23% y el triangulo relleno de MUI. Con los tokens queda a juego con el
    // resto del panel y el borde se adapta al modo claro/oscuro.
    kanbanControl: {
        marginBottom: theme.palette.tokens.space.sm,
        "& .MuiOutlinedInput-root": {
            borderRadius: theme.palette.tokens.radius.md,
            backgroundColor: theme.palette.tokens.surface.surface,
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.tokens.border.border,
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.tokens.border.strong,
        },
        "& .MuiSelect-icon": {
            color: theme.palette.tokens.text.muted,
            right: theme.palette.tokens.space.sm,
        },
    },
    // El color de la etiqueta lo elige quien la crea, asi que el texto de
    // encima no puede ser blanco fijo: sobre una etiqueta amarilla no se leia.
    // onColor() decide blanco o negro segun el fondo real.
    kanbanChip: {
        borderRadius: theme.palette.tokens.radius.sm,
        fontWeight: 600,
        fontSize: "0.6875rem",
        whiteSpace: "nowrap",
    },
}));
export function TagsKanbanContainer({ ticket }) {
    const classes = useStyles();
    const theme = useTheme();

    const [tags, setTags] = useState([]);
    const [selected, setSelected] = useState(""); // Alterado de null para ""

    useEffect(() => {
        let isMounted = true;
        loadTags(isMounted).then(() => {
            if (ticket.tags && ticket.tags.length > 0) {
                setSelected(ticket.tags[0].id); // Alterado para pegar o ID da primeira tag, se existir
            }
        });

        return () => {
            isMounted = false;
        };
    }, [ticket.tags]);

    const loadTags = async (isMounted) => {
        try {
            const { data } = await api.get(`/tags/list`, { params: { kanban: 1 } });
            if (isMounted) {
                setTags(data);
            }
        } catch (err) {
            toastError(err);
        }
    }

    const onChange = async (e) => {
        const value = e.target.value;
        if (ticket.tags.length > 0) {
            await api.delete(`/ticket-tags/${ticket.id}`);
            // toast.success('Ticket Tag Removido!');
        }
        if (value !== null) {
            await api.put(`/ticket-tags/${ticket.id}/${value}`);
            // toast.success('Ticket Tag Adicionado com Sucesso!');
        }
        setSelected(value);
        // Adicione sua lógica de manipulação de tags aqui
    }

    const renderSelectedValue = () => {
        const selectedTag = tags.find(tag => tag.id === selected);
        if (!selectedTag) return null;

        return (
            <Chip
                className={classes.kanbanChip}
                style={{
                    backgroundColor: selectedTag.color,
                    color: theme.palette.tokens.onColor(selectedTag.color),
                }}
                label={selectedTag.name}
                size="small"
            />
        );
    };

    return (
        <>
            <FormControl
                fullWidth
                margin="dense"
                variant="outlined"
                className={classes.kanbanControl}
            >
                <InputLabel id="tag-kanban-id">
                    {i18n.t("contactDrawer.kanbanStage")}
                </InputLabel>
                <Select
                    labelWidth={60}
                    IconComponent={ExpandMore}
                    value={selected}
                    labelId="tag-kanban-id"
                    label={i18n.t("contactDrawer.kanbanStage")}
                    onChange={onChange}
                    MenuProps={{
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left",
                        },
                        transformOrigin: {
                            vertical: "top",
                            horizontal: "left",
                        },
                        getContentAnchorEl: null,
                    }}
                    renderValue={renderSelectedValue}
                >
                    <MenuItem value={null}>&nbsp;</MenuItem>
                    {tags.map(tag => (
                        <MenuItem key={tag.id} value={tag.id}>
                            {tag.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    )
}
