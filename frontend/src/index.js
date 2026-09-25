import React from "react";
import ReactDOM from "react-dom";
// import * as serviceworker from './serviceWorker'

import App from "./App";

// O CssBaseline saiu daqui e passou para dentro do ThemeProvider, em App.js.
//
// Aqui fora ele nao tinha tema nenhum, entao usava o tema por omissao do MUI
// e injetava em body a tipografia desse tema: Roboto. Essa regra e injetada em
// tempo de execucao, portanto ganhava a declaracao de Inter que ja existia em
// public/index.html. O resultado era que a aplicacao descarregava Inter com
// nove pesos e mostrava Roboto.
ReactDOM.render(
	<App />,
	document.getElementById("root"),
	() => {
		window.finishProgress();
	}
);

// DESABILITADO TEMPORARIAMENTE - Service Worker causando problemas de cache
// serviceworker.register()

// Desregistrar service workers existentes para limpar cache antigo
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service Worker desregistrado:', registration);
    }
  });
}