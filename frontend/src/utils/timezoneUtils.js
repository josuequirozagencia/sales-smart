import React from 'react';
import moment from 'moment-timezone';

// Lista de fusos horários organizados por região
export const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: '(GMT-05:00) Nova York, Estados Unidos', region: 'América do Norte' },
  { value: 'America/Chicago', label: '(GMT-06:00) Chicago, Estados Unidos', region: 'América do Norte' },
  { value: 'America/Denver', label: '(GMT-07:00) Denver, Estados Unidos', region: 'América do Norte' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Los Angeles, Estados Unidos', region: 'América do Norte' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Anchorage, Alasca', region: 'América do Norte' },
  { value: 'America/Toronto', label: '(GMT-05:00) Toronto, Canadá', region: 'América do Norte' },
  { value: 'America/Vancouver', label: '(GMT-08:00) Vancouver, Canadá', region: 'América do Norte' },
  { value: 'America/Mexico_City', label: '(GMT-06:00) Cidade do México, México', region: 'América do Norte' },
  
  // América do Sul
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) São Paulo, Brasil', region: 'América do Sul' },
  { value: 'America/Rio_Branco', label: '(GMT-05:00) Rio Branco, Brasil', region: 'América do Sul' },
  { value: 'America/Manaus', label: '(GMT-04:00) Manaus, Brasil', region: 'América do Sul' },
  { value: 'America/Belem', label: '(GMT-03:00) Belém, Brasil', region: 'América do Sul' },
  { value: 'America/Fortaleza', label: '(GMT-03:00) Fortaleza, Brasil', region: 'América do Sul' },
  { value: 'America/Recife', label: '(GMT-03:00) Recife, Brasil', region: 'América do Sul' },
  { value: 'America/Cuiaba', label: '(GMT-04:00) Cuiabá, Brasil', region: 'América do Sul' },
  { value: 'America/Porto_Velho', label: '(GMT-04:00) Porto Velho, Brasil', region: 'América do Sul' },
  { value: 'America/Boa_Vista', label: '(GMT-04:00) Boa Vista, Brasil', region: 'América do Sul' },
  { value: 'America/Campo_Grande', label: '(GMT-04:00) Campo Grande, Brasil', region: 'América do Sul' },
  { value: 'America/Noronha', label: '(GMT-02:00) Fernando de Noronha, Brasil', region: 'América do Sul' },
  { value: 'America/Buenos_Aires', label: '(GMT-03:00) Buenos Aires, Argentina', region: 'América do Sul' },
  { value: 'America/Santiago', label: '(GMT-04:00) Santiago, Chile', region: 'América do Sul' },
  { value: 'America/Lima', label: '(GMT-05:00) Lima, Peru', region: 'América do Sul' },
  { value: 'America/Bogota', label: '(GMT-05:00) Bogotá, Colômbia', region: 'América do Sul' },
  { value: 'America/Caracas', label: '(GMT-04:00) Caracas, Venezuela', region: 'América do Sul' },
  { value: 'America/La_Paz', label: '(GMT-04:00) La Paz, Bolívia', region: 'América do Sul' },
  { value: 'America/Montevideo', label: '(GMT-03:00) Montevidéu, Uruguai', region: 'América do Sul' },
  { value: 'America/Asuncion', label: '(GMT-03:00) Assunção, Paraguai', region: 'América do Sul' },
  { value: 'America/Guyana', label: '(GMT-04:00) Georgetown, Guiana', region: 'América do Sul' },
  { value: 'America/Paramaribo', label: '(GMT-03:00) Paramaribo, Suriname', region: 'América do Sul' },
  
  // Europa
  { value: 'Europe/London', label: '(GMT+00:00) Londres, Reino Unido', region: 'Europa' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris, França', region: 'Europa' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlim, Alemanha', region: 'Europa' },
  { value: 'Europe/Madrid', label: '(GMT+01:00) Madrid, Espanha', region: 'Europa' },
  { value: 'Europe/Rome', label: '(GMT+01:00) Roma, Itália', region: 'Europa' },
  { value: 'Europe/Amsterdam', label: '(GMT+01:00) Amsterdã, Holanda', region: 'Europa' },
  { value: 'Europe/Brussels', label: '(GMT+01:00) Bruxelas, Bélgica', region: 'Europa' },
  { value: 'Europe/Vienna', label: '(GMT+01:00) Viena, Áustria', region: 'Europa' },
  { value: 'Europe/Warsaw', label: '(GMT+01:00) Varsóvia, Polônia', region: 'Europa' },
  { value: 'Europe/Lisbon', label: '(GMT+00:00) Lisboa, Portugal', region: 'Europa' },
  { value: 'Europe/Athens', label: '(GMT+02:00) Atenas, Grécia', region: 'Europa' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscou, Rússia', region: 'Europa' },
  { value: 'Europe/Istanbul', label: '(GMT+03:00) Istambul, Turquia', region: 'Europa' },
  { value: 'Europe/Stockholm', label: '(GMT+01:00) Estocolmo, Suécia', region: 'Europa' },
  { value: 'Europe/Oslo', label: '(GMT+01:00) Oslo, Noruega', region: 'Europa' },
  { value: 'Europe/Copenhagen', label: '(GMT+01:00) Copenhague, Dinamarca', region: 'Europa' },
  { value: 'Europe/Helsinki', label: '(GMT+02:00) Helsinque, Finlândia', region: 'Europa' },
  { value: 'Europe/Dublin', label: '(GMT+00:00) Dublin, Irlanda', region: 'Europa' },
  { value: 'Europe/Zurich', label: '(GMT+01:00) Zurique, Suíça', region: 'Europa' },
  
  // Ásia
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tóquio, Japão', region: 'Ásia' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Xangai, China', region: 'Ásia' },
  { value: 'Asia/Hong_Kong', label: '(GMT+08:00) Hong Kong', region: 'Ásia' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapura', region: 'Ásia' },
  { value: 'Asia/Seoul', label: '(GMT+09:00) Seul, Coreia do Sul', region: 'Ásia' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Tailândia', region: 'Ásia' },
  { value: 'Asia/Jakarta', label: '(GMT+07:00) Jacarta, Indonésia', region: 'Ásia' },
  { value: 'Asia/Manila', label: '(GMT+08:00) Manila, Filipinas', region: 'Ásia' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) Calcutá, Índia', region: 'Ásia' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai, Emirados Árabes', region: 'Ásia' },
  { value: 'Asia/Tel_Aviv', label: '(GMT+02:00) Tel Aviv, Israel', region: 'Ásia' },
  { value: 'Asia/Riyadh', label: '(GMT+03:00) Riade, Arábia Saudita', region: 'Ásia' },
  { value: 'Asia/Tehran', label: '(GMT+03:30) Teerã, Irã', region: 'Ásia' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi, Paquistão', region: 'Ásia' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Daca, Bangladesh', region: 'Ásia' },
  { value: 'Asia/Kuala_Lumpur', label: '(GMT+08:00) Kuala Lumpur, Malásia', region: 'Ásia' },
  { value: 'Asia/Taipei', label: '(GMT+08:00) Taipei, Taiwan', region: 'Ásia' },
  
  // África
  { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo, Egito', region: 'África' },
  { value: 'Africa/Lagos', label: '(GMT+01:00) Lagos, Nigéria', region: 'África' },
  { value: 'Africa/Johannesburg', label: '(GMT+02:00) Joanesburgo, África do Sul', region: 'África' },
  { value: 'Africa/Nairobi', label: '(GMT+03:00) Nairóbi, Quênia', region: 'África' },
  { value: 'Africa/Casablanca', label: '(GMT+00:00) Casablanca, Marrocos', region: 'África' },
  { value: 'Africa/Tunis', label: '(GMT+01:00) Túnis, Tunísia', region: 'África' },
  { value: 'Africa/Algiers', label: '(GMT+01:00) Argel, Argélia', region: 'África' },
  { value: 'Africa/Addis_Ababa', label: '(GMT+03:00) Adis Abeba, Etiópia', region: 'África' },
  { value: 'Africa/Dakar', label: '(GMT+00:00) Dacar, Senegal', region: 'África' },
  { value: 'Africa/Accra', label: '(GMT+00:00) Acra, Gana', region: 'África' },
  
  // Oceania
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Austrália', region: 'Oceania' },
  { value: 'Australia/Melbourne', label: '(GMT+10:00) Melbourne, Austrália', region: 'Oceania' },
  { value: 'Australia/Brisbane', label: '(GMT+10:00) Brisbane, Austrália', region: 'Oceania' },
  { value: 'Australia/Perth', label: '(GMT+08:00) Perth, Austrália', region: 'Oceania' },
  { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide, Austrália', region: 'Oceania' },
  { value: 'Australia/Darwin', label: '(GMT+09:30) Darwin, Austrália', region: 'Oceania' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Nova Zelândia', region: 'Oceania' },
  { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji', region: 'Oceania' },
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Honolulu, Havaí', region: 'Oceania' },
  
  // UTC
  { value: 'UTC', label: '(GMT+00:00) Tempo Universal Coordenado', region: 'UTC' },
];

// Agrupar fusos horários por região
export const getTimezonesByRegion = () => {
  const grouped = {};
  TIMEZONES.forEach(tz => {
    if (!grouped[tz.region]) {
      grouped[tz.region] = [];
    }
    grouped[tz.region].push(tz);
  });
  return grouped;
};

// Obter fuso horário atual do usuário
export const getCurrentTimezone = () => {
  const savedTimezone = localStorage.getItem('userTimezone');
  if (savedTimezone) {
    const timezone = TIMEZONES.find(tz => tz.value === savedTimezone);
    if (timezone) return timezone;
  }
  
  // Tenta detectar o fuso horário do navegador
  const browserTimezone = moment.tz.guess();
  const foundTimezone = TIMEZONES.find(tz => tz.value === browserTimezone);
  
  // Se encontrou, retorna; senão, retorna São Paulo como padrão
  return foundTimezone || TIMEZONES.find(tz => tz.value === 'America/Sao_Paulo');
};

// Salvar fuso horário selecionado
export const setCurrentTimezone = (timezoneValue) => {
  localStorage.setItem('userTimezone', timezoneValue);
  moment.tz.setDefault(timezoneValue);
  
  // Disparar evento customizado para notificar mudança
  window.dispatchEvent(new CustomEvent('timezoneChanged', { detail: timezoneValue }));
};

// Converter data para o fuso horário do usuário
export const convertToUserTimezone = (date, format = 'DD/MM/YYYY HH:mm:ss') => {
  const timezone = getCurrentTimezone();
  if (!date) return '';
  
  return moment(date).tz(timezone.value).format(format);
};

// Converter data do fuso horário do usuário para UTC
export const convertToUTC = (date) => {
  const timezone = getCurrentTimezone();
  if (!date) return null;
  
  return moment.tz(date, timezone.value).utc().toISOString();
};

// Obter offset do fuso horário
export const getTimezoneOffset = (timezoneValue = null) => {
  const timezone = timezoneValue || getCurrentTimezone().value;
  return moment.tz(timezone).format('Z');
};

// Formatar data com fuso horário
export const formatDateWithTimezone = (date, format = 'DD/MM/YYYY HH:mm:ss z') => {
  const timezone = getCurrentTimezone();
  if (!date) return '';
  
  return moment(date).tz(timezone.value).format(format);
};

// Hook React para usar fuso horário
export const useTimezone = () => {
  const [timezone, setTimezone] = React.useState(getCurrentTimezone());

  React.useEffect(() => {
    const handleTimezoneChange = (event) => {
      const newTimezone = TIMEZONES.find(tz => tz.value === event.detail);
      if (newTimezone) {
        setTimezone(newTimezone);
      }
    };

    window.addEventListener('timezoneChanged', handleTimezoneChange);
    return () => {
      window.removeEventListener('timezoneChanged', handleTimezoneChange);
    };
  }, []);

  return {
    timezone,
    timezones: TIMEZONES,
    timezonesByRegion: getTimezonesByRegion(),
    convertToUserTimezone,
    convertToUTC,
    formatDateWithTimezone,
    setCurrentTimezone,
    getTimezoneOffset
  };
};