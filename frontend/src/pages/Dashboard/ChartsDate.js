import React, { useEffect, useState, useContext, useCallback, useMemo, memo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LabelList,
    ResponsiveContainer,
} from 'recharts';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import brLocale from 'date-fns/locale/pt-BR';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { Button, Grid, TextField } from '@material-ui/core';
import Typography from "@material-ui/core/Typography";
import api from '../../services/api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import './button.css';
import { i18n } from '../../translate/i18n';
import { AuthContext } from "../../context/Auth/AuthContext";
import { useTheme } from '@material-ui/core';

export const ChartsDate = memo(() => {
    const theme = useTheme();
    const [initialDate, setInitialDate] = useState(new Date());
    const [finalDate, setFinalDate] = useState(new Date());
    const [ticketsData, setTicketsData] = useState({ data: [], count: 0 });
    const [hasInitialLoad, setHasInitialLoad] = useState(false);
    const { user } = useContext(AuthContext);

    const companyId = user?.companyId;

    // Função memoizada para buscar dados
    const handleGetTicketsInformation = useCallback(async () => {
        if (!companyId) return;
        
        try {
            const { data } = await api.get(`/dashboard/ticketsDay`, {
                params: {
                    initialDate: format(initialDate, 'yyyy-MM-dd'),
                    finalDate: format(finalDate, 'yyyy-MM-dd'),
                    companyId
                }
            });
            setTicketsData(data);
        } catch (error) {
            toast.error('Erro ao buscar informações dos tickets');
        }
    }, [initialDate, finalDate, companyId]);

    // UseEffect para carga inicial apenas
    useEffect(() => {
        if (companyId && !hasInitialLoad) {
            handleGetTicketsInformation();
            setHasInitialLoad(true);
        }
    }, [companyId, hasInitialLoad, handleGetTicketsInformation]);

    // Dados do gráfico memoizados
    const chartData = useMemo(() => {
        const hasData = ticketsData?.data?.length > 0;
        if (!hasData) return [];

        return ticketsData.data.map((item) => ({
            label: item.hasOwnProperty('horario')
                ? `Das ${item.horario}:00 as ${item.horario}:59`
                : item.data,
            total: item.total,
        }));
    }, [ticketsData]);

    // Callbacks memoizados para os date pickers
    const handleInitialDateChange = useCallback((newValue) => {
        setInitialDate(newValue);
    }, []);

    const handleFinalDateChange = useCallback((newValue) => {
        setFinalDate(newValue);
    }, []);

    return (
        <>
            <Typography component="h2" gutterBottom style={{ fontSize: 16, fontWeight: 700, color: theme.palette.text.primary }}>
                {i18n.t("dashboard.users.totalAttendances")} ({ticketsData?.count})
            </Typography>

            <Grid container spacing={2}>
                <Grid item>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
                        <DatePicker
                            value={initialDate}
                            onChange={handleInitialDateChange}
                            label={i18n.t("dashboard.date.initialDate")}
                            renderInput={(params) => <TextField fullWidth {...params} sx={{ width: '20ch' }} />}
                        />
                    </LocalizationProvider>
                </Grid>
                <Grid item>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
                        <DatePicker
                            value={finalDate}
                            onChange={handleFinalDateChange}
                            label={i18n.t("dashboard.date.finalDate")}
                            renderInput={(params) => <TextField fullWidth {...params} sx={{ width: '20ch' }} />}
                        />
                    </LocalizationProvider>
                </Grid>
                <Grid item>
                    <Button 
                        style={{
                            // El fondo se ponia aqui en linea pero sin fijar
                            // el color del texto, asi que el boton se quedaba
                            // con el texto oscuro que trae .MuiButton-contained
                            // para su gris por defecto: texto casi negro sobre
                            // violeta, 2.47 de contraste.
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.tokens.onColor(
                                theme.palette.primary.main
                            ),
                            top: '10px'
                        }} 
                        onClick={handleGetTicketsInformation} 
                        variant='contained'
                    >
                        {i18n.t("dashboard.buttons.filter")}
                    </Button>
                </Grid>
            </Grid>
            <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                        <XAxis
                            dataKey="label"
                            stroke={theme.palette.text.secondary}
                            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                        />
                        <YAxis
                            allowDecimals={false}
                            stroke={theme.palette.text.secondary}
                            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme.palette.background.paper,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8,
                                color: theme.palette.text.primary,
                            }}
                            labelStyle={{ color: theme.palette.text.primary }}
                            cursor={{ fill: theme.palette.action.hover }}
                        />
                        <Bar
                            dataKey="total"
                            name="Tickets"
                            fill={theme.palette.primary.main}
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                        >
                            <LabelList
                                dataKey="total"
                                position="top"
                                style={{
                                    fill: theme.palette.text.primary,
                                    fontSize: 13,
                                    fontWeight: 700,
                                }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </>
    );
});
