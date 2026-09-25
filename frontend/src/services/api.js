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

// Cabeçalho de autorização já na criação da instância.
//
// Sem isto havia uma corrida na carga da página: vários componentes disparam
// requisições no seu próprio useEffect antes de o useAuth terminar de chamar
// /auth/refresh_token e definir o header. Essas requisições saíam sem
// Authorization, o backend devolvia 401 (ERR_SESSION_EXPIRED, que é o erro de
// "header ausente" — token vencido devolve 403), e o tratamento do 401 apagava
// o token e zerava o header. A partir daí toda requisição seguinte também ia
// sem header: a sessão nunca se recuperava, a tela continuava aberta e nada
// funcionava — nem enviar arquivos, nem qualquer outra ação.
try {
	const storedToken = localStorage.getItem("token");
	if (storedToken) {
		// O token é guardado com JSON.stringify, então vem entre aspas.
		const token = JSON.parse(storedToken);
		if (token) {
			api.defaults.headers.Authorization = `Bearer ${token}`;
		}
	}
} catch (err) {
	// Um token corrompido no localStorage não pode impedir a aplicação de subir;
	// sem header, o fluxo normal de login assume.
	console.warn("Token inválido no localStorage, será ignorado:", err);
}

// Adicionar interceptor para debug
api.interceptors.request.use(
	(config) => {
		// Esta instância define Content-Type: application/json por padrão, mas
		// envios de mídia usam FormData (api.post(`/messages/:id`, formData)).
		// No axios 1.x, transformRequest converte FormData em JSON quando o
		// Content-Type é application/json (formDataToJSON), o que descartaria o
		// arquivo binário e quebraria o envio de anexos sem qualquer erro.
		// Removendo o header, o navegador define multipart/form-data com o
		// boundary correto.
		const isFormData =
			typeof FormData !== "undefined" && config.data instanceof FormData;

		if (isFormData && config.headers) {
			// axios 1.x usa AxiosHeaders (tem .delete); o 0.x usa objeto simples.
			if (typeof config.headers.delete === "function") {
				config.headers.delete("Content-Type");
			} else {
				delete config.headers["Content-Type"];
			}
		}

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
