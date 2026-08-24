import React from 'react';
import { useCurrency } from '../../utils/currencyUtils';

/**
 * Componente para exibir valores monetários formatados
 * Usa a moeda configurada globalmente no sistema
 * 
 * @param {number} value - Valor a ser formatado
 * @param {boolean} showSymbol - Se deve mostrar o símbolo da moeda (padrão: true)
 * @param {string} className - Classes CSS adicionais
 * @param {object} style - Estilos inline adicionais
 */
const CurrencyDisplay = ({ value, showSymbol = true, className = '', style = {} }) => {
    const { formatCurrency, getCurrencySymbol } = useCurrency();
    
    // Se não houver valor, exibe zero
    const displayValue = value || 0;
    
    // Formata o valor
    const formattedValue = showSymbol 
        ? formatCurrency(displayValue)
        : formatCurrency(displayValue).replace(getCurrencySymbol(), '').trim();
    
    return (
        <span className={className} style={style}>
            {formattedValue}
        </span>
    );
};

export default CurrencyDisplay;