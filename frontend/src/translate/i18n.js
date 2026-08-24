import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

// Obtém o idioma salvo ou usa 'pt' como fallback inicial
const savedLang = localStorage.getItem('i18nextLng');

i18n.use(LanguageDetector).init({
	debug: false,
	defaultNS: ["translations"],
	fallbackLng: savedLang || "pt", // Usa o idioma salvo como fallback
	ns: ["translations"],
	resources: messages,
	detection: {
		order: ['localStorage', 'navigator'], // Prioriza localStorage
		caches: ['localStorage'],
		lookupLocalStorage: 'i18nextLng',
	},
});

export { i18n };
