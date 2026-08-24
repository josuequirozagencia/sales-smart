import { useCallback } from "react";
import api from "../../services/api";
import { toast } from "react-toastify";

// Valores padrão constantes fora do hook
const DEFAULT_COUNTERS = {
  avgSupportTime: 0,
  avgWaitTime: 0,
  supportFinished: 0,
  supportHappening: 0,
  supportPending: 0,
  supportGroups: 0,
  leads: 0,
  activeTickets: 0,
  passiveTickets: 0,
  tickets: 0,
  waitRating: 0,
  withoutRating: 0,
  withRating: 0,
  percRating: 0,
  npsPromotersPerc: 0,
  npsPassivePerc: 0,
  npsDetractorsPerc: 0,
  npsScore: 0
};

const DEFAULT_RESPONSE = {
  counters: DEFAULT_COUNTERS,
  attendants: []
};

const useDashboard = () => {
  
  const find = useCallback(async (params) => {
    try {
      const { data } = await api.request({
        url: `/dashboard`,
        method: 'GET',
        params
      });

      if (!data) {
        throw new Error('Nenhum dado retornado do servidor');
      }

      return {
        counters: { ...DEFAULT_COUNTERS, ...data.counters },
        attendants: Array.isArray(data.attendants) ? data.attendants : []
      };
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      
      if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Erro ao carregar dados do dashboard');
      }
      
      return DEFAULT_RESPONSE;
    }
  }, []);

  const getReport = useCallback(async (params) => {
    try {
      const { data } = await api.request({
        url: `/ticketreport/reports`,
        method: 'GET',
        params
      });

      return data;
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
      
      if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Erro ao carregar relatório');
      }
      
      return { data: [] };
    }
  }, []);

  return {
    find,
    getReport
  };
};

export default useDashboard;