import pino from 'pino';
import moment from 'moment-timezone';
import { businessTimezone } from '../helpers/RotationPolicy';

// Função para obter o timestamp com fuso horário
const timezoned = () => {
  return moment().tz(businessTimezone()).format('DD-MM-YYYY HH:mm:ss');
};

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss', // Use this para tradução de tempo
      ignore: "pid,hostname"
    },
  },
  timestamp: () => `,"time":"${timezoned()}"`, // Adiciona o timestamp formatado
});

export default logger;
