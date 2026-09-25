import { Chip, Paper, TextField } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

export function TagsContainer({ contact }) {
    const theme = useTheme();

    const [tags, setTags] = useState([]);
    const [selecteds, setSelecteds] = useState([]);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (isMounted.current) {
            loadTags().then(() => {
                if (Array.isArray(contact.tags)) {
                    setSelecteds(contact.tags);
                } else {
                    setSelecteds([]);
                }
            });
        }
    }, [contact]);

    const createTag = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const loadTags = async () => {
        try {
            const { data } = await api.get(`/tags/list`, 
            {params: { kanban: 0}
        });
            setTags(data);
        } catch (err) {
            toastError(err);
        }
    }

    const syncTags = async (data) => {
        try {
            const { data: responseData } = await api.post(`/tags/sync`, data);
            return responseData;
        } catch (err) {
            toastError(err);
        }
    }

    const onChange = async (value, reason) => {
        let optionsChanged = []
        if (reason === 'create-option') {
            if (isArray(value)) {
                for (let item of value) {
                    if (item.length < 3) {
                        toastError("Tag muito curta!");
                        return;
                    }
                    if (isString(item)) {
                        const newTag = await createTag({ name: item, kanban: 0, color: getRandomHexColor() })
                        optionsChanged.push(newTag);
                    } else {
                        optionsChanged.push(item);
                    }
                }
            }
            await loadTags();
        } else {
            optionsChanged = value;
        }
        setSelecteds(optionsChanged);
        await syncTags({ contactId: contact.id, tags: optionsChanged });
    }

    function getRandomHexColor() {
        // Gerar valores aleatórios para os componentes de cor
        const red = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const green = Math.floor(Math.random() * 256); // Valor entre 0 e 255
        const blue = Math.floor(Math.random() * 256); // Valor entre 0 e 255
      
        // Converter os componentes de cor em uma cor hexadecimal
        const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      
        return hexColor;
    }

    return (
        <Paper style={{ padding: 2 }}>
            <Autocomplete
                multiple
                size="small"
                options={tags}
                value={selecteds}
                freeSolo
                onChange={(e, v, r) => onChange(v, r)}
                getOptionLabel={(option) => option.name}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip
                            variant="outlined"
                            style={(() => {
                                // El color de la etiqueta se genera al azar al
                                // crearla (getRandomHexColor), y el texto era
                                // blanco fijo: cualquier color claro que saliera
                                // dejaba la etiqueta ilegible.
                                //
                                // onColor elige blanco o tinta oscura segun el
                                // fondo, igual que en las insignias del ticket.
                                const fondo = option.color || theme.palette.tokens.surface.surfaceSecondary;
                                return {
                                    backgroundColor: fondo,
                                    color: theme.palette.tokens.onColor(fondo),
                                    marginRight: 4,
                                    marginBottom: 2,
                                    fontWeight: 500,
                                    paddingLeft: 4,
                                    paddingRight: 4,
                                    // 3px era casi un angulo recto. 6 encaja con
                                    // la escala de radios del sistema.
                                    borderRadius: theme.palette.tokens.radius.sm + 2,
                                    fontSize: "0.75rem",
                                    // Antes era nowrap sin limite: una etiqueta
                                    // de nombre largo empujaba la fila entera.
                                    maxWidth: 180,
                                };
                            })()}
                            label={option.name}
                            {...getTagProps({ index })}
                            size="small"
                        />
                    ))
                }
                renderInput={(params) => (
                    <TextField {...params} variant="outlined" placeholder="Tags" />
                )}
                PaperComponent={({ children }) => (
                    <Paper
                        style={{ width: 400, marginLeft: 6 }}
                    >
                        {children}
                    </Paper>
                )}
            />
        </Paper>
    )
}