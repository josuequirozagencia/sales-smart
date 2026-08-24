import React, { useEffect, useState, useContext, useCallback, useMemo, memo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
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

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Options movidas para fora e memoizadas
const chartOptions = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
            display: false,
        },
        title: {
            display: true,
            text: 'Tickets',
            position: 'left',
        },
        datalabels: {
            display: true,
            anchor: 'start',
            offset: -30,
            align: "start",
            color: "#fff",
            textStrokeColor: "#000",
            textStrokeWidth: 2,
            font: {
                size: 20,
                weight: "bold"
            },
        }
    },
};

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
    const dataCharts = useMemo(() => {
        const hasData = ticketsData?.data?.length > 0;
        
        if (!hasData) {
            return {
                labels: [],
                datasets: [{ data: [], backgroundColor: theme.palette.primary.main }]
            };
        }

        return {
            labels: ticketsData.data.map((item) => 
                item.hasOwnProperty('horario') 
                    ? `Das ${item.horario}:00 as ${item.horario}:59` 
                    : item.data
            ),
            datasets: [
                {
                    data: ticketsData.data.map((item) => item.total),
                    backgroundColor: theme.palette.primary.main,
                },
            ],
        };
    }, [ticketsData, theme.palette.primary.main]);

    // Callbacks memoizados para os date pickers
    const handleInitialDateChange = useCallback((newValue) => {
        setInitialDate(newValue);
    }, []);

    const handleFinalDateChange = useCallback((newValue) => {
        setFinalDate(newValue);
    }, []);

    return (
        <>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
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
                        style={{ backgroundColor: theme.palette.primary.main, top: '10px' }} 
                        onClick={handleGetTicketsInformation} 
                        variant='contained'
                    >
                        Filtrar
                    </Button>
                </Grid>
            </Grid>
            <Bar options={chartOptions} data={dataCharts} style={{ maxWidth: '100%', maxHeight: '280px' }} />
        </>
    );
});