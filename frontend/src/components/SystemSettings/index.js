import React, { useState } from "react";
import {
    makeStyles,
    Paper,
    Grid,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Box,
    Typography
} from "@material-ui/core";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { toast } from "react-toastify";
import { AttachMoney } from "@material-ui/icons";
import { 
    useCurrency
} from "../../utils/currencyUtils";

const useStyles = makeStyles(theme => ({
    root: {
        width: '100%'
    },
    mainPaper: {
        width: '100%',
        flex: 1,
        padding: theme.spacing(3)
    },
    section: {
        marginBottom: theme.spacing(4),
        padding: theme.spacing(3),
        borderRadius: theme.spacing(1),
        backgroundColor: theme.palette.background.default
    },
    sectionTitle: {
        marginBottom: theme.spacing(3),
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1)
    },
    icon: {
        color: theme.palette.primary.main
    }
}));

export default function SystemSettings() {
    const classes = useStyles();
    const { currency, currencies, setCurrentCurrency: updateCurrency } = useCurrency();
    
    const [selectedCurrency, setSelectedCurrency] = useState(currency.code);
    const [loading, setLoading] = useState(false);

    const handleCurrencyChange = (event) => {
        const newCurrency = event.target.value;
        setSelectedCurrency(newCurrency);
    };

    const handleSaveCurrency = () => {
        setLoading(true);
        try {
            updateCurrency(selectedCurrency);
            toast.success('Moeda do sistema salva com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar moeda do sistema');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper className={classes.mainPaper} elevation={0}>
            <Box className={classes.section}>
                <div className={classes.sectionTitle}>
                    <AttachMoney className={classes.icon} />
                    <Typography variant="h5">
                        Moeda do Sistema
                    </Typography>
                </div>
                
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 24 }}>
                    Esta configuração define a moeda padrão utilizada em todo o sistema.
                    Apenas super administradores podem alterá-la.
                </Typography>

                <Grid container spacing={3}>
                    {/* Moeda do Sistema */}
                    <Grid item xs={12} md={6}>
                        <FormControl variant="outlined" fullWidth>
                            <InputLabel>Selecione a Moeda</InputLabel>
                            <Select
                                value={selectedCurrency}
                                onChange={handleCurrencyChange}
                                label="Selecione a Moeda"
                            >
                                {currencies.map((curr) => (
                                    <MenuItem key={curr.code} value={curr.code}>
                                        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                            <span>{curr.symbol} - {curr.name}</span>
                                            <span style={{ marginLeft: 16, color: '#999', fontSize: '0.9em' }}>
                                                ({curr.code})
                                            </span>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: 'block' }}>
                            Define a moeda padrão para exibição de valores em todo o sistema
                        </Typography>
                    </Grid>
                </Grid>
                
                {/* Botões de ação */}
                <Grid container spacing={2} style={{ marginTop: 24 }} justifyContent="flex-end">
                    <Grid item xs={12} sm={4} md={3}>
                        <ButtonWithSpinner 
                            fullWidth
                            loading={loading}
                            onClick={handleSaveCurrency} 
                            variant="contained" 
                            color="primary"
                            size="large"
                        >
                            Salvar Moeda
                        </ButtonWithSpinner>
                    </Grid>
                </Grid>
                
                <Box mt={3} p={2} style={{ backgroundColor: '#fff3cd', borderRadius: 4 }}>
                    <Typography variant="body2" style={{ color: '#856404' }}>
                        <strong>⚠️ Atenção:</strong> A alteração da moeda afeta imediatamente a exibição de valores em todo o sistema.
                        Certifique-se de que a mudança é necessária antes de salvá-la.
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
}