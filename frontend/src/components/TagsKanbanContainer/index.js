import { Chip, Select, MenuItem, InputLabel, FormControl } from "@material-ui/core";
import React from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
// Chevron del set propio, en trazo, en lugar del triangulo relleno de serie.
import { ExpandMore } from "../Icons";
import useTicketPipelineStage from "../../hooks/useTicketPipelineStage";

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

/**
 * Embudo y etapa del ticket en la ficha del contacto.
 *
 * Las etapas ya no salen de todas las etiquetas kanban de la empresa, que con
 * varios tableros venian mezcladas: salen del embudo elegido. El selector de
 * embudo solo aparece cuando hay mas de uno; con uno solo la ficha se ve igual
 * que antes.
 */
export function TagsKanbanContainer({ ticket }) {
    const classes = useStyles();
    const theme = useTheme();

    const {
        pipelines,
        pipelineId,
        setPipelineId,
        stages,
        stageId,
        selectStage,
    } = useTicketPipelineStage(ticket);

    const renderSelectedValue = () => {
        const selectedTag = stages.find(tag => tag.id === stageId);
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

    const menuProps = {
        anchorOrigin: { vertical: "bottom", horizontal: "left" },
        transformOrigin: { vertical: "top", horizontal: "left" },
        getContentAnchorEl: null,
    };

    return (
        <>
            {pipelines.length > 1 && (
                <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    className={classes.kanbanControl}
                >
                    <InputLabel id="pipeline-kanban-id">
                        {i18n.t("contactDrawer.kanbanPipeline")}
                    </InputLabel>
                    <Select
                        labelWidth={60}
                        IconComponent={ExpandMore}
                        value={pipelineId}
                        labelId="pipeline-kanban-id"
                        label={i18n.t("contactDrawer.kanbanPipeline")}
                        onChange={e => setPipelineId(e.target.value)}
                        MenuProps={menuProps}
                    >
                        {pipelines.map(p => (
                            <MenuItem key={p.id} value={p.id}>
                                {p.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

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
                    value={stageId}
                    labelId="tag-kanban-id"
                    label={i18n.t("contactDrawer.kanbanStage")}
                    onChange={e => selectStage(e.target.value)}
                    MenuProps={menuProps}
                    renderValue={renderSelectedValue}
                >
                    <MenuItem value="">&nbsp;</MenuItem>
                    {stages.map(tag => (
                        <MenuItem key={tag.id} value={tag.id}>
                            {tag.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    )
}
