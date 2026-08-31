import React, { useState, useEffect } from "react";

import Tickets from "../TicketsCustom";
import TicketAdvanced from "../TicketsAdvanced";

// Ancho a partir del cual se muestra la variante de escritorio.
//
// Es el mismo valor que tenia withWidth con isWidthUp("md"): el breakpoint
// md de MUI. Se deja como constante con nombre para que se vea de donde sale
// y no haya que deducirlo del HOC.
const ANCHO_ESCRITORIO = 960;

/**
 * Elige entre las dos pantallas de tickets segun el ancho.
 *
 * Antes usaba el HOC withWidth de MUI v4. Comprobado en el navegador:
 * withWidth resuelve bien en la carga, pero no reevalua al redimensionar.
 * Viniendo de 959px, al pasar a 961 se seguia mostrando la variante movil
 * hasta recargar la pagina. Es el mismo comportamiento que tenia
 * drawerVariant en el App Shell, y se resuelve igual: escuchando el resize
 * de forma explicita.
 *
 * Nota sobre el cambio de variante: al cruzar el umbral se desmonta una
 * pantalla y se monta la otra, asi que un mensaje a medio escribir se
 * pierde. Es el precio de que la variante sea correcta; antes el mensaje se
 * conservaba pero la pantalla quedaba equivocada, que es peor.
 */
const TicketResponsiveContainer = () => {
  const [esEscritorio, setEsEscritorio] = useState(
    typeof window !== "undefined"
      ? window.innerWidth >= ANCHO_ESCRITORIO
      : true
  );

  useEffect(() => {
    const evaluar = () => {
      setEsEscritorio(window.innerWidth >= ANCHO_ESCRITORIO);
    };

    evaluar();
    window.addEventListener("resize", evaluar);
    return () => window.removeEventListener("resize", evaluar);
  }, []);

  return esEscritorio ? <Tickets /> : <TicketAdvanced />;
};

export default TicketResponsiveContainer;
