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
	// O navegador informa variantes regionais: 'es-EC', 'pt-BR', 'en-US'. As
	// chaves dos recursos em translate/languages são só o idioma ('es', 'pt',
	// 'en'), então sem isto o i18next procura 'es-EC', não encontra e cai no
	// fallbackLng — a interface aparecia em português para quem tem o
	// navegador em espanhol. `languageOnly` reduz a variante ao idioma base.
	load: 'languageOnly',
	supportedLngs: ['pt', 'en', 'es', 'ar', 'tr'],
	nonExplicitSupportedLngs: true,
	detection: {
		order: ['localStorage', 'navigator'], // Prioriza localStorage
		caches: ['localStorage'],
		lookupLocalStorage: 'i18nextLng',
	},
});

export { i18n };
