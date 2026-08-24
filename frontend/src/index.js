import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
// import * as serviceworker from './serviceWorker'

import App from "./App";

ReactDOM.render(
	<CssBaseline>
		<App />
	</CssBaseline>,
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