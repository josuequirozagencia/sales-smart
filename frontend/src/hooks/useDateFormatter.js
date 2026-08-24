import { useEffect, useState, useCallback } from 'react';
import { useTimezone } from '../utils/timezoneUtils';
import moment from 'moment-timezone';

/**
 * Hook customizado para formatação de datas com suporte a fuso horário
 * Atualiza automaticamente quando o fuso horário é alterado
 */
const useDateFormatter = () => {
    const { timezone, convertToUserTimezone, convertToUTC, formatDateWithTimezone } = useTimezone();
    const [refreshKey, setRefreshKey] = useState(0);

    // Atualizar quando o fuso horário mudar
    useEffect(() => {
        const handleTimezoneChange = () => {
            setRefreshKey(prev => prev + 1);
        };

        window.addEventListener('timezoneChanged', handleTimezoneChange);
        return () => {
            window.removeEventListener('timezoneChanged', handleTimezoneChange);
        };
    }, []);

    // Função para formatar data
    const formatDate = useCallback((date, format = 'DD/MM/YYYY HH:mm') => {
        if (!date) return '';
        return convertToUserTimezone(date, format);
    }, [convertToUserTimezone, refreshKey]);

    // Função para formatar data com timezone
    const formatDateWithTz = useCallback((date, format = 'DD/MM/YYYY HH:mm z') => {
        if (!date) return '';
        return formatDateWithTimezone(date, format);
    }, [formatDateWithTimezone, refreshKey]);

    // Função para formatar data relativa (ex: "há 2 minutos")
    const formatRelative = useCallback((date) => {
        if (!date) return '';
        return moment(date).tz(timezone.value).fromNow();
    }, [timezone, refreshKey]);

    // Função para formatar duração (ex: "2 horas e 30 minutos")
    const formatDuration = useCallback((startDate, endDate) => {
        if (!startDate || !endDate) return '';
        
        const start = moment(startDate).tz(timezone.value);
        const end = moment(endDate).tz(timezone.value);
        const duration = moment.duration(end.diff(start));
        
        const days = duration.days();
        const hours = duration.hours();
        const minutes = duration.minutes();
        
        let result = [];
        if (days > 0) result.push(`${days} dia${days > 1 ? 's' : ''}`);
        if (hours > 0) result.push(`${hours} hora${hours > 1 ? 's' : ''}`);
        if (minutes > 0) result.push(`${minutes} minuto${minutes > 1 ? 's' : ''}`);
        
        return result.join(' e ') || 'menos de 1 minuto';
    }, [timezone, refreshKey]);

    // Função para verificar se é hoje
    const isToday = useCallback((date) => {
        if (!date) return false;
        const userDate = moment(date).tz(timezone.value);
        const today = moment().tz(timezone.value);
        return userDate.isSame(today, 'day');
    }, [timezone, refreshKey]);

    // Função para verificar se é ontem
    const isYesterday = useCallback((date) => {
        if (!date) return false;
        const userDate = moment(date).tz(timezone.value);
        const yesterday = moment().tz(timezone.value).subtract(1, 'day');
        return userDate.isSame(yesterday, 'day');
    }, [timezone, refreshKey]);

    // Função para formatar data inteligente
    const formatSmart = useCallback((date) => {
        if (!date) return '';
        
        const userDate = moment(date).tz(timezone.value);
        const now = moment().tz(timezone.value);
        
        // Se for hoje, mostra apenas a hora
        if (userDate.isSame(now, 'day')) {
            return `Hoje às ${userDate.format('HH:mm')}`;
        }
        
        // Se for ontem
        if (userDate.isSame(now.clone().subtract(1, 'day'), 'day')) {
            return `Ontem às ${userDate.format('HH:mm')}`;
        }
        
        // Se for esta semana
        if (userDate.isSame(now, 'week')) {
            return userDate.format('dddd [às] HH:mm');
        }
        
        // Se for este ano
        if (userDate.isSame(now, 'year')) {
            return userDate.format('DD/MM [às] HH:mm');
        }
        
        // Caso contrário, mostra data completa
        return userDate.format('DD/MM/YYYY [às] HH:mm');
    }, [timezone, refreshKey]);

    // Função para obter partes da data
    const getDateParts = useCallback((date) => {
        if (!date) return null;
        
        const userDate = moment(date).tz(timezone.value);
        
        return {
            year: userDate.year(),
            month: userDate.month() + 1,
            day: userDate.date(),
            hour: userDate.hour(),
            minute: userDate.minute(),
            second: userDate.second(),
            dayOfWeek: userDate.day(),
            weekOfYear: userDate.week(),
            timestamp: userDate.valueOf(),
            iso: userDate.toISOString(),
            formatted: {
                date: userDate.format('DD/MM/YYYY'),
                time: userDate.format('HH:mm:ss'),
                datetime: userDate.format('DD/MM/YYYY HH:mm:ss'),
                full: userDate.format('LLLL')
            }
        };
    }, [timezone, refreshKey]);

    return {
        formatDate,
        formatDateWithTz,
        formatRelative,
        formatDuration,
        formatSmart,
        isToday,
        isYesterday,
        getDateParts,
        convertToUTC,
        timezone: timezone.value,
        timezoneLabel: timezone.label,
        refreshKey // Para forçar re-render quando necessário
    };
};

export default useDateFormatter;