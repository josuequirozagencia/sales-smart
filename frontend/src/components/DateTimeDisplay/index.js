import React from 'react';
import { useTimezone } from '../../utils/timezoneUtils';
import { Tooltip } from '@material-ui/core';
import moment from 'moment-timezone';

/**
 * Componente para exibir datas e horários formatados com o fuso horário do usuário
 * 
 * @param {string|Date} date - Data a ser formatada
 * @param {string} format - Formato de exibição (padrão: 'DD/MM/YYYY HH:mm')
 * @param {boolean} showTimezone - Se deve mostrar o fuso horário (padrão: false)
 * @param {boolean} showTooltip - Se deve mostrar tooltip com informações adicionais (padrão: true)
 * @param {string} className - Classes CSS adicionais
 * @param {object} style - Estilos inline adicionais
 */
const DateTimeDisplay = ({ 
    date, 
    format = 'DD/MM/YYYY HH:mm',
    showTimezone = false,
    showTooltip = true,
    className = '', 
    style = {} 
}) => {
    const { timezone, formatDateWithTimezone } = useTimezone();
    
    if (!date) {
        return <span className={className} style={style}>-</span>;
    }
    
    // Formatar a data com o fuso horário do usuário
    const displayFormat = showTimezone ? `${format} (z)` : format;
    const formattedDate = formatDateWithTimezone(date, displayFormat);
    
    // Criar conteúdo do tooltip
    const tooltipContent = () => {
        const localTime = moment(date).tz(timezone.value);
        const utcTime = moment(date).utc();
        
        return (
            <div style={{ fontSize: '12px' }}>
                <div><strong>Horário Local:</strong> {localTime.format('DD/MM/YYYY HH:mm:ss')}</div>
                <div><strong>Fuso Horário:</strong> {timezone.label}</div>
                <div><strong>UTC:</strong> {utcTime.format('DD/MM/YYYY HH:mm:ss')}</div>
                <div><strong>Relativo:</strong> {localTime.fromNow()}</div>
            </div>
        );
    };
    
    if (showTooltip) {
        return (
            <Tooltip title={tooltipContent()} arrow placement="top">
                <span className={className} style={{ cursor: 'help', ...style }}>
                    {formattedDate}
                </span>
            </Tooltip>
        );
    }
    
    return (
        <span className={className} style={style}>
            {formattedDate}
        </span>
    );
};

export default DateTimeDisplay;