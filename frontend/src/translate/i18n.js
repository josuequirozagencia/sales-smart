import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

// Idioma de respaldo cuando no hay nada guardado y el navegador no
// coincide con ninguno de los soportados. Es ESPANOL: esta instalacion
// atiende a clientes de habla hispana, y antes caia en portugues.
//
// A quien tenga el navegador en portugues o ingles se le sigue mostrando
// el suyo: esto solo decide el caso en que no hay coincidencia.
const IDIOMA_POR_DEFECTO = 'es';

const savedLang = localStorage.getItem('i18nextLng');

i18n.use(LanguageDetector).init({
	debug: false,
	defaultNS: ["translations"],
	fallbackLng: savedLang || IDIOMA_POR_DEFECTO,
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

/**
 * Reduce un codigo de idioma a su base: 'es-419' y 'es-EC' son 'es',
 * 'pt-BR' es 'pt'.
 *
 * El navegador informa variantes regionales, y las listas de idiomas de
 * las pantallas usan unas veces el codigo base ('es') y otras la variante
 * ('pt-BR'). Comparar sin reducir hacia que no coincidiera nada y la
 * etiqueta cayera en la primera opcion de la lista —portugues— aunque la
 * interfaz estuviera en espanol.
 *
 * Vive aqui, junto a la configuracion de idioma, para no tener una copia
 * por pantalla.
 */
export const soloIdioma = (codigo) =>
  String(codigo || "").split("-")[0].toLowerCase();

export { i18n, IDIOMA_POR_DEFECTO };
