import React from 'react';

// Configurações de moedas disponíveis
export const CURRENCIES = [
  {
    code: 'BRL',
    symbol: 'R$',
    name: 'Real Brasileiro',
    locale: 'pt-BR',
    decimalSeparator: ',',
    thousandSeparator: '.'
  },
  {
    code: 'USD',
    symbol: '$',
    name: 'Dólar Americano',
    locale: 'en-US',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    decimalSeparator: ',',
    thousandSeparator: '.'
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'Libra Esterlina',
    locale: 'en-GB',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'JPY',
    symbol: '¥',
    name: 'Iene Japonês',
    locale: 'ja-JP',
    decimalSeparator: '.',
    thousandSeparator: ',',
    minimumFractionDigits: 0
  },
  {
    code: 'CNY',
    symbol: '¥',
    name: 'Yuan Chinês',
    locale: 'zh-CN',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'ARS',
    symbol: '$',
    name: 'Peso Argentino',
    locale: 'es-AR',
    decimalSeparator: ',',
    thousandSeparator: '.'
  },
  {
    code: 'MXN',
    symbol: '$',
    name: 'Peso Mexicano',
    locale: 'es-MX',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'CLP',
    symbol: '$',
    name: 'Peso Chileno',
    locale: 'es-CL',
    decimalSeparator: ',',
    thousandSeparator: '.',
    minimumFractionDigits: 0
  },
  {
    code: 'COP',
    symbol: '$',
    name: 'Peso Colombiano',
    locale: 'es-CO',
    decimalSeparator: ',',
    thousandSeparator: '.',
    minimumFractionDigits: 0
  },
  {
    code: 'PEN',
    symbol: 'S/',
    name: 'Sol Peruano',
    locale: 'es-PE',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'UYU',
    symbol: '$',
    name: 'Peso Uruguaio',
    locale: 'es-UY',
    decimalSeparator: ',',
    thousandSeparator: '.'
  },
  {
    code: 'PYG',
    symbol: '₲',
    name: 'Guarani Paraguaio',
    locale: 'es-PY',
    decimalSeparator: ',',
    thousandSeparator: '.',
    minimumFractionDigits: 0
  },
  {
    code: 'BOB',
    symbol: 'Bs',
    name: 'Boliviano',
    locale: 'es-BO',
    decimalSeparator: ',',
    thousandSeparator: '.'
  },
  {
    code: 'CAD',
    symbol: 'C$',
    name: 'Dólar Canadense',
    locale: 'en-CA',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: 'Dólar Australiano',
    locale: 'en-AU',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'INR',
    symbol: '₹',
    name: 'Rupia Indiana',
    locale: 'en-IN',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'RUB',
    symbol: '₽',
    name: 'Rublo Russo',
    locale: 'ru-RU',
    decimalSeparator: ',',
    thousandSeparator: ' '
  },
  {
    code: 'ZAR',
    symbol: 'R',
    name: 'Rand Sul-Africano',
    locale: 'en-ZA',
    decimalSeparator: '.',
    thousandSeparator: ','
  },
  {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Franco Suíço',
    locale: 'de-CH',
    decimalSeparator: '.',
    thousandSeparator: "'"
  }
];

// Obter moeda do localStorage ou usar BRL como padrão
export const getCurrentCurrency = () => {
  const savedCurrency = localStorage.getItem('selectedCurrency');
  if (savedCurrency) {
    const currency = CURRENCIES.find(c => c.code === savedCurrency);
    if (currency) return currency;
  }
  return CURRENCIES[0]; // BRL como padrão
};

// Salvar moeda selecionada
export const setCurrentCurrency = (currencyCode) => {
  localStorage.setItem('selectedCurrency', currencyCode);
  // Disparar evento customizado para notificar mudança
  window.dispatchEvent(new CustomEvent('currencyChanged', { detail: currencyCode }));
};

// Formatar valor com a moeda selecionada
export const formatCurrency = (value, currencyCode = null) => {
  const currency = currencyCode 
    ? CURRENCIES.find(c => c.code === currencyCode) || getCurrentCurrency()
    : getCurrentCurrency();
  
  if (!value && value !== 0) return `${currency.symbol} 0,00`;
  
  try {
    const options = {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.minimumFractionDigits !== undefined 
        ? currency.minimumFractionDigits 
        : 2,
      maximumFractionDigits: 2
    };
    
    return new Intl.NumberFormat(currency.locale, options).format(value);
  } catch (error) {
    // Fallback para formatação manual se Intl falhar
    const formatted = value.toFixed(currency.minimumFractionDigits || 2);
    return `${currency.symbol} ${formatted}`;
  }
};

// Formatar apenas o símbolo da moeda
export const getCurrencySymbol = (currencyCode = null) => {
  const currency = currencyCode 
    ? CURRENCIES.find(c => c.code === currencyCode) || getCurrentCurrency()
    : getCurrentCurrency();
  return currency.symbol;
};

// Hook React para usar moeda atual
export const useCurrency = () => {
  const [currency, setCurrency] = React.useState(getCurrentCurrency());

  React.useEffect(() => {
    const handleCurrencyChange = (event) => {
      const newCurrency = CURRENCIES.find(c => c.code === event.detail);
      if (newCurrency) {
        setCurrency(newCurrency);
      }
    };

    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => {
      window.removeEventListener('currencyChanged', handleCurrencyChange);
    };
  }, []);

  return {
    currency,
    formatCurrency,
    getCurrencySymbol,
    setCurrentCurrency,
    currencies: CURRENCIES
  };
};