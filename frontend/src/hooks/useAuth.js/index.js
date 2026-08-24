import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import moment from "moment";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});
  const [socket, setSocket] = useState(null);
  
  // Ref para manter referência dos listeners ativos
  const listenersRef = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Interceptors do API (mantém como estava)
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        setIsAuth(true);
      }
      return config;
    },
    (error) => {
      Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      
      // Salvar rota atual antes de possível redirecionamento
      if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
        localStorage.setItem("redirectAfterLogin", window.location.pathname);
      }
      
      if (error?.response?.status === 403 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const { data } = await api.post("/auth/refresh_token");
          if (data) {
            localStorage.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.Authorization = `Bearer ${data.token}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
        }
      }
      
      if (error?.response?.status === 401 && window.location.pathname !== "/login") {
        localStorage.removeItem("token");
        api.defaults.headers.Authorization = undefined;
        setIsAuth(false);
      }
      
      return Promise.reject(error);
    }
  );

  // Effect para inicialização do token
  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          const { data } = await api.post("/auth/refresh_token");
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
          setIsAuth(true);
          setUser(data.user || data);
        } catch (err) {
          toastError(err);
        }
      }
      setLoading(false);
    })();
  }, []);

  // Effect para configuração do socket
  useEffect(() => {
    if (Object.keys(user).length && user.id > 0) {
      console.log("Configurando socket para user", user.id, "company", user.companyId);
      
      // Limpar listeners anteriores
      if (socket) {
        listenersRef.current.forEach(eventName => {
          if (socket.off) {
            socket.off(eventName);
          }
        });
        listenersRef.current.clear();
      }

      // Função para criar conexão com retry logic
      const createSocketConnection = () => {
        try {
          const socketInstance = socketConnection({ 
            user: {
              companyId: user.companyId,
              id: user.id 
            }
          });
          
          if (socketInstance) {
            setSocket(socketInstance);
            reconnectAttemptsRef.current = 0;

            // Configurar listeners após conexão estabelecida
            socketInstance.on('connect', () => {
              console.log('Socket conectado com sucesso');
              const eventName = `company-${user.companyId}-user`;
              
              const handleUserUpdate = (data) => {
                if (data.action === "update" && data.user.id === user.id) {
                  setUser(data.user);
                }
              };

              if (typeof socketInstance.on === 'function') {
                socketInstance.on(eventName, handleUserUpdate);
                listenersRef.current.add(eventName);
                console.log(`Listener adicionado para: ${eventName}`);
              }
            });

            // Configurar reconexão automática
            socketInstance.on('disconnect', () => {
              console.log('Socket desconectado, tentando reconectar...');
              if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++;
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                reconnectTimeoutRef.current = setTimeout(createSocketConnection, delay);
              }
            });
          }
        } catch (error) {
          console.error('Erro ao criar conexão socket:', error);
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectTimeoutRef.current = setTimeout(createSocketConnection, delay);
          }
        }
      };

      createSocketConnection();
    }

    // Cleanup function melhorada
    return () => {
      // Limpar timeout de reconexão
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Limpar listeners do socket
      if (socket && listenersRef.current.size > 0) {
        console.log("Limpando listeners do socket para user", user.id);
        listenersRef.current.forEach(eventName => {
          if (typeof socket.off === 'function') {
            socket.off(eventName);
          }
        });
        listenersRef.current.clear();
        
        // Desconectar socket se necessário
        if (typeof socket.disconnect === 'function') {
          socket.disconnect();
        }
      }
    };
  }, [user.id, user.companyId]); // Dependências específicas

  // Effect para buscar dados do usuário atual
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user || data);
      } catch (err) {
        console.log("Erro ao buscar usuário atual:", err);
      }
    };
    
    if (isAuth) {
      fetchCurrentUser();
    }
  }, [isAuth]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { company },
      } = data;

      // Lógica de configurações da empresa (mantém como estava)
      if (
        has(company, "companieSettings") &&
        isArray(company.companieSettings[0])
      ) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null);
        }
      }

      if (
        has(company, "companieSettings") &&
        isArray(company.companieSettings[0])
      ) {
        const setting = company.companieSettings[0].find(
          (s) => s.key === "sendSignMessage"
        );

        const signEnable = setting.value === "enable";

        if (setting && setting.value === "enabled") {
          localStorage.setItem("sendSignMessage", signEnable);
        }
      }
      
      localStorage.setItem("profileImage", data.user.profileImage);

      moment.locale("pt-br");
      let dueDate;
      if (data.user.company.id === 1) {
        dueDate = "2999-12-31T00:00:00.000Z";
      } else {
        dueDate = data.user.company.dueDate;
      }
      
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(dueDate).diff(moment(moment()).format());
      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      if (before === true) {
        localStorage.setItem("token", JSON.stringify(data.token));
        localStorage.setItem("companyDueDate", vencimento);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setUser(data.user || data);
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        
        if (Math.round(dias) < 5) {
          toast.warn(
            `Sua assinatura vence em ${Math.round(dias)} ${
              Math.round(dias) === 1 ? "dia" : "dias"
            } `
          );
        }

        // Redirecionar para a rota pretendida ou tickets como fallback
        const redirectTo = localStorage.getItem("redirectAfterLogin") || "/tickets";
        localStorage.removeItem("redirectAfterLogin");
        history.push(redirectTo);
        setLoading(false);
      } else {
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setIsAuth(true);
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        history.push("/financeiro-aberto");
        setLoading(false);
      }
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      // Limpar socket antes do logout
      if (socket) {
        listenersRef.current.forEach(eventName => {
          if (socket.off) {
            socket.off(eventName);
          }
        });
        listenersRef.current.clear();
        
        if (typeof socket.disconnect === 'function') {
          socket.disconnect();
        }
      }

      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      setSocket(null);
      localStorage.removeItem("token");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      console.log(data);
      return data;
    } catch (_) {
      return null;
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
    socket,
  };
};

export default useAuth;