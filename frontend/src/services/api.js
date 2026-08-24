import axios from "axios";
import { getBackendUrl } from "../config";

// Obter a URL do backend
const backendUrl = getBackendUrl() || "http://localhost:8080";

console.log("Backend URL configurada:", backendUrl);

const api = axios.create({
	baseURL: backendUrl,
	withCredentials: true,
	headers: {
		'Content-Type': 'application/json',
	}
});

export const openApi = axios.create({
	baseURL: backendUrl,
	headers: {
		'Content-Type': 'application/json',
	}
});

// Adicionar interceptor para debug
api.interceptors.request.use(
	(config) => {
		console.log("Fazendo requisição para:", config.url);
		return config;
	},
	(error) => {
		console.error("Erro na requisição:", error);
		return Promise.reject(error);
	}
);

api.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		console.error("Erro na resposta:", error.message);
		if (error.code === 'ERR_NETWORK') {
			console.error("Erro de rede - Verifique se o backend está rodando em:", backendUrl);
		}
		return Promise.reject(error);
	}
);

export default api;
