import React, { useState, useEffect, useMemo } from "react";
import api from "./services/api";
import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import {
  createTheme as createThemeV5,
  ThemeProvider as ThemeProviderV5,
} from "@mui/material/styles";
import { CssBaseline, useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo.png";
import defaultLogoDark from "./assets/logo-black.png";
import defaultLogoFavicon from "./assets/favicon.ico";
import useSettings from "./hooks/useSettings";
import { applyInstallationCurrency } from "./utils/currencyUtils";
import tokens, { onColor } from "./theme/tokens";

import "./styles/animations.css";

const queryClient = new QueryClient();

const App = () => {
  const [locale, setLocale] = useState();
  const appColorLocalStorage =
    localStorage.getItem("primaryColorLight") ||
    localStorage.getItem("primaryColorDark") ||
    // Violeta de la marca. Es solo el valor mientras el backend responde;
    // si la empresa tiene color configurado, ese gana.
    tokens.brandScale[600];
  const appNameLocalStorage = localStorage.getItem("appName") || "";
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const preferredTheme = window.localStorage.getItem("preferredTheme");
  const [mode, setMode] = useState(
    preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light"
  );
  const [primaryColorLight, setPrimaryColorLight] =
    useState(appColorLocalStorage);
  const [primaryColorDark, setPrimaryColorDark] =
    useState(appColorLocalStorage);
  const [appLogoLight, setAppLogoLight] = useState(defaultLogoLight);
  const [appLogoDark, setAppLogoDark] = useState(defaultLogoDark);
  const [appLogoFavicon, setAppLogoFavicon] = useState(defaultLogoFavicon);
  const [appName, setAppName] = useState(appNameLocalStorage);
  const { getPublicSetting } = useSettings();

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          window.localStorage.setItem("preferredTheme", newMode); // Persistindo o tema no localStorage
          return newMode;
        });
      },
      setPrimaryColorLight,
      setPrimaryColorDark,
      setAppLogoLight,
      setAppLogoDark,
      setAppLogoFavicon,
      setAppName,
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      mode,
    }),
    [appLogoLight, appLogoDark, appLogoFavicon, appName, mode]
  );

  // Opções do tema numa variável só, para alimentar as DUAS versões do MUI.
  //
  // O projeto usa @material-ui (v4) em 251 arquivos e @mui (v5) em 66, e os
  // dois leem de contextos React diferentes. Como só existia o ThemeProvider
  // da v4, os componentes da v5 caíam no tema padrão do MUI: cor, tipografia
  // e espaçamentos do projeto simplesmente não chegavam neles. Era por isso
  // que a interface parecia inconsistente de uma tela para outra.
  const themeOptions = useMemo(
    () => {
      // Superficies, texto y bordes del modo activo. Claro y oscuro no
      // comparten valores: invertir el claro produce grises que se pierden
      // sobre fondo oscuro, asi que cada modo tiene su propio juego.
      const t = mode === "light" ? tokens.light : tokens.dark;

      // El primario lo configura cada empresa desde Ajustes > Whitelabel, de
      // modo que aqui puede llegar cualquier cosa. normalizeHex lo garantiza
      // valido antes de derivar hover y active.
      const brandPrimary = tokens.normalizeHex(
        mode === "light" ? primaryColorLight : primaryColorDark
      );
      const brandSecondary =
        mode === "light"
          ? tokens.secondaryDefault
          : tokens.secondaryDefaultDark;

      // El primario como TEXTO o BORDE sobre la superficie. Como lo elige
      // cada empresa, puede ser muy claro: #D3D1DC da 1,5 sobre blanco y
      // dejaba casi invisibles los botones con borde, las pestanas activas
      // y los titulos. En claro se oscurece lo justo para llegar a 4,5
      // (texto) o 3 (bordes); una marca que ya cumple sale igual. En oscuro
      // se mantiene el nivel 300 de la marca, como hasta ahora.
      const brandText =
        mode === "light"
          ? tokens.legibleSobre(brandPrimary, t.surface)
          : tokens.brandScale[300];
      const brandBorder =
        mode === "light"
          ? tokens.legibleSobre(brandPrimary, t.surface, 3)
          : tokens.brandScale[300];

      return {
          // 19 componentes leem `theme.mode` para decidir cores, mas essa
          // chave nunca existiu no tema: no MUI v4 o correto é
          // `theme.palette.type`. Como `undefined === "light"` é sempre
          // falso, todos esses ternários caíam na opção de modo escuro
          // mesmo com a interface em claro — daí textos cinza claro sobre
          // fundo branco e a sensação de que nada se distingue.
          //
          // Expor `mode` aqui conserta os 19 de uma vez. O certo a longo
          // prazo é migrá-los para `palette.mode`, que é o nome na v5.
          mode,
          // Scrollbar styles melhorados mas usando cores do tema
          scrollbarStyles: {
            "&::-webkit-scrollbar": {
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
              backgroundColor:
                mode === "light" ? primaryColorLight : primaryColorDark, // Usa cores do tema
              borderRadius: "4px", // Bordas arredondadas
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: mode === "light" ? "#f5f5f5" : "#2a2a2a",
              borderRadius: "4px",
            },
          },

          scrollbarStylesSoft: {
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: mode === "light" ? "#E0E0E0" : "#404040",
              borderRadius: "4px",
              "&:hover": {
                backgroundColor: mode === "light" ? "#BDBDBD" : "#505050",
              }
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "transparent",
            },
          },

          palette: {
            type: mode,
            // Limite para escolher entre texto claro e escuro sobre uma cor.
            // O padrão do MUI é 3, que só atende ao WCAG AA em texto grande;
            // 4.5 é o exigido para texto normal.
            contrastThreshold: 4.5,
            primary: {
              main: mode === "light" ? primaryColorLight : primaryColorDark, // Usa cores dinâmicas
              // light, dark e contrastText saem do main, calculados pelo MUI.
              //
              // Antes eram `${cor}80` e `${cor}CC`, ou seja, a MESMA cor com
              // opacidade — não um tom mais claro e outro mais escuro. Duas
              // consequências: primary.light ficava translúcido (texto branco
              // em cima dava contraste 2.52, abaixo do mínimo de 4.5) e
              // primary.dark não escurecia nada, então o hover dos botões
              // quase não mudava.
              //
              // O contrastText também era fixo em branco. Como a cor da marca
              // se configura em Ajustes > Whitelabel, uma cor clara deixava os
              // botões ilegíveis: verde #4CAF50 dá 2.78 e amarelo #F4C430 dá
              // 1.64 com texto branco. Deixando o MUI decidir, ele troca para
              // texto escuro quando a cor pede.
            },
            // --- Claves estandar de MUI, alimentadas desde los tokens -----
            //
            // Ninguna de estas estaba definida, asi que hasta ahora regian
            // los valores por defecto de MUI. Definirlas es lo que hace que
            // el sistema llegue a los componentes sin tocar ninguno:
            // text.secondary lo leen 21 archivos, background.paper otros 21
            // y divider 15.
            //
            // contrastText se calcula en vez de fijarse en blanco. Es la
            // correccion del fallo central de la auditoria: el naranja
            // #f7953b con texto blanco da 2.25 de contraste; con texto
            // oscuro da 7.92.
            secondary: {
              main: brandSecondary,
              contrastText: onColor(brandSecondary),
            },
            background: {
              default: t.background,
              paper: t.surface,
            },
            text: {
              primary: t.textPrimary,
              secondary: t.textSecondary,
              disabled: t.textMuted,
            },
            divider: t.border,
            success: {
              main: tokens.semantic.success.fill,
              contrastText: onColor(tokens.semantic.success.fill),
            },
            warning: {
              main: tokens.semantic.warning.fill,
              contrastText: onColor(tokens.semantic.warning.fill),
            },
            error: {
              main: tokens.semantic.error.fill,
              contrastText: onColor(tokens.semantic.error.fill),
            },
            info: {
              main: tokens.semantic.info.fill,
              contrastText: onColor(tokens.semantic.info.fill),
            },

            // --- Espacio propio del sistema visual ------------------------
            //
            // Lo que MUI no tiene donde guardar. Las fases siguientes leen de
            // aqui; nada de lo de arriba ni de lo de abajo cambia por ello.
            tokens: {
              brand: {
                primary: brandPrimary,
                primaryHover: tokens.darken(brandPrimary, 0.08),
                primaryActive: tokens.darken(brandPrimary, 0.16),
                onPrimary: onColor(brandPrimary),
                // El color de marca en un tono legible COMO TEXTO sobre la
                // superficie del modo activo. El primario a secas no sirve
                // para eso: en oscuro, el tono que lleva texto blanco encima
                // es demasiado oscuro; en claro, un primario muy claro no se
                // lee sobre blanco. Ver brandText.
                onSurface: brandText,
                secondary: brandSecondary,
                secondaryHover: tokens.darken(brandSecondary, 0.08),
                onSecondary: onColor(brandSecondary),
              },
              surface: {
                background: t.background,
                surface: t.surface,
                surfaceSecondary: t.surfaceSecondary,
                elevated: t.surfaceElevated,
              },
              // La navegacion se trata como pieza oscura y separada del
              // contenido, igual en los dos modos.
              sidebar: tokens.sidebar[mode === "light" ? "light" : "dark"],
              brandScale: tokens.brandScale,
              text: {
                primary: t.textPrimary,
                secondary: t.textSecondary,
                muted: t.textMuted,
              },
              border: {
                border: t.border,
                strong: t.borderStrong,
              },
              semantic: tokens.semantic,
              external: tokens.brand,
              space: tokens.space,
              radius: tokens.radius,
              shadow: tokens.shadow,
              onColor,
            },

            // --- Claves personalizadas preexistentes ----------------------
            // Se dejan intactas por compatibilidad: hay componentes leyendo
            // tabHeaderBackground (6), optionsBackground (3), barraSuperior,
            // fancyBackground y total (2 cada una) e inputBackground (1).
            textPrimary:
              mode === "light" ? primaryColorLight : primaryColorDark,
            borderPrimary:
              mode === "light" ? primaryColorLight : primaryColorDark,
            dark: { main: mode === "light" ? "#333333" : "#F3F3F3" },
            light: { main: mode === "light" ? "#F3F3F3" : "#333333" },
            fontColor: mode === "light" ? primaryColorLight : primaryColorDark,
            tabHeaderBackground: mode === "light" ? "#EEE" : "#666",
            optionsBackground: mode === "light" ? "#fafafa" : "#333",
            fancyBackground: mode === "light" ? "#fafafa" : "#333",
            total: mode === "light" ? "#fff" : "#222",
            messageIcons: mode === "light" ? "grey" : "#F3F3F3",
            inputBackground: mode === "light" ? "#FFFFFF" : "#333",
            barraSuperior: mode === "light" ? primaryColorLight : "#666", // Usa cor do tema
          },

          typography: {
            fontFamily: [
              'Inter',
              'Roboto',
              '-apple-system',
              'BlinkMacSystemFont',
              '"Segoe UI"',
              '"Helvetica Neue"',
              'Arial',
              'sans-serif',
            ].join(','),
            // Tamanos explicitos. Los de serie del MUI v4 son enormes —h1
            // son 96px— porque estan pensados para paginas, no para una
            // herramienta densa que se usa ocho horas al dia.
            //
            // body2 se deja intacto a proposito: el CssBaseline lo aplica al
            // body, asi que es la base de la aplicacion y tocarlo encogeria
            // el texto de las 397 pantallas de golpe.
            h1: {
              fontSize: '1.75rem', // 28px
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.025em',
            },
            h2: {
              fontSize: '1.375rem', // 22px
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
            },
            h3: {
              fontSize: '1.125rem', // 18px
              fontWeight: 600,
              lineHeight: 1.4,
              letterSpacing: '-0.015em',
            },
            h4: {
              fontSize: '1rem', // 16px
              fontWeight: 600,
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
            },
            h5: {
              fontSize: '0.9375rem', // 15px
              fontWeight: 600,
              lineHeight: 1.45,
            },
            h6: {
              fontSize: '0.875rem', // 14px
              fontWeight: 600,
              lineHeight: 1.45,
            },
            body1: {
              fontSize: '0.9375rem', // 15px
              lineHeight: 1.55,
            },
            caption: {
              fontSize: '0.75rem', // 12px
              lineHeight: 1.45,
            },
            button: {
              fontWeight: 600,
              textTransform: 'none',
              letterSpacing: '0.025em',
            },
          },

          shape: {
            borderRadius: 8, // Bordas arredondadas mas não excessivas
          },
          overrides: {
            // Botões usando cor do tema
            MuiButton: {
              root: {
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: '0.01em',
                // 180ms. Los 300ms anteriores se notan como lentitud en una
                // herramienta que se usa a diario.
                transition: 'background-color 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                minHeight: 36,
                paddingLeft: 16,
                paddingRight: 16,
                // Se retira el translateY del hover: el boton saltaba un
                // pixel al pasar por encima, que es un efecto de plantilla y
                // ademas descuadra las filas de botones.
              },
              contained: {
                boxShadow: tokens.shadow.sm,
                '&:hover': {
                  boxShadow: tokens.shadow.md,
                },
              },
              outlined: {
                borderColor: t.border,
              },
              // Mismo caso que MuiTypography: aqui el primario es texto, no
              // relleno. El borde de serie es el primario al 50 %, que con un
              // primario claro desaparece: se usa el tono de borde legible.
              textPrimary: {
                color: brandText,
              },
              outlinedPrimary: {
                color: brandText,
                borderColor: brandBorder,
                '&:hover': {
                  borderColor: brandText,
                },
              },
            },

            // Campos de formulario. Sin esto quedan con el aspecto de serie
            // del MUI v4, que es lo que mas delata la edad de la interfaz.
            MuiOutlinedInput: {
              root: {
                borderRadius: tokens.radius.md,
                backgroundColor: t.surface,
                transition: 'border-color 180ms ease, box-shadow 180ms ease',
                '& fieldset': {
                  borderColor: t.border,
                },
                '&:hover fieldset': {
                  borderColor: t.borderStrong,
                },
                '&.Mui-focused fieldset': {
                  borderWidth: 1,
                },
                // Halo de foco. Ademas de estetico es de accesibilidad: deja
                // claro donde esta el cursor al navegar con el teclado.
                '&.Mui-focused': {
                  boxShadow: `0 0 0 3px ${brandPrimary}22`,
                },
              },
              input: {
                paddingTop: 10,
                paddingBottom: 10,
              },
            },

            // La etiqueta, colocada para el alto REAL del campo.
            //
            // El relleno de arriba deja los campos en 38px, pero MUI sitúa la
            // etiqueta sin encoger a 20px del borde, que es lo que centra en
            // los 56px de serie: quedaba montada sobre la línea de abajo en
            // todos los campos con etiqueta flotante de la aplicación. 12px es
            // el mismo valor que MUI usa para su variante densa, que tiene
            // justo este alto.
            MuiInputLabel: {
              outlined: {
                transform: 'translate(14px, 12px) scale(1)',
                '&.MuiInputLabel-marginDense': {
                  transform: 'translate(14px, 12px) scale(1)',
                },
                // Encogida sigue en su sitio: sobre el borde superior.
                '&.MuiInputLabel-shrink': {
                  transform: 'translate(14px, -6px) scale(0.75)',
                },
              },
            },

            // El primario como COLOR DE TEXTO sobre superficie oscura.
            //
            // Un solo tono no puede servir para las dos cosas: el que lleva
            // texto blanco encima con contraste suficiente (#803adf, 5.85) es
            // demasiado oscuro para leerse sobre el fondo oscuro, donde se
            // queda en 2.5. Aparecio en el panel en tres sitios y es el mismo
            // problema que ya resolvimos para los semanticos separando fill y
            // text.
            //
            // Se corrige aqui, en los dos sitios donde MUI aplica el primario
            // como texto, en vez de perseguir cada componente: en claro se
            // oscurece solo si hace falta (ver brandText), y en oscuro sube al
            // nivel 300 de la marca, que da 6.25 sobre el fondo.
            MuiTypography: {
              colorPrimary: {
                color: brandText,
              },
            },

            // Pestanas. La etiqueta activa y la barra indicadora usan el
            // primario como texto: brandText, legible en los dos modos. Aqui
            // se corrigen todas las pestanas del CRM a la vez en lugar de
            // pantalla por pantalla.
            //
            // Habia un segundo MuiTab mas abajo en este mismo objeto; al ser
            // la misma clave, anulaba a este entero y la pestana activa
            // volvia al primario crudo. Ahora es uno solo.
            MuiTab: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: '0.025em',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: `${brandPrimary}08`,
                },
                // Tambien para las pestanas con textColor inherit.
                '&.Mui-selected': {
                  color: brandText,
                },
              },
              textColorPrimary: {
                "&.Mui-selected": {
                  color: brandText,
                },
              },
            },
            MuiTabs: {
              indicator: {
                backgroundColor: brandText,
              },
            },

            // Insignias y etiquetas.
            MuiChip: {
              root: {
                borderRadius: tokens.radius.sm,
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
              },
            },

            MuiContainer: {
              root: {
                paddingLeft: '0 !important',
                paddingRight: '0 !important',
                maxWidth: 'none !important',
                width: '100% !important',
              },
              maxWidthLg: {
                maxWidth: 'none !important',
              },
              maxWidthMd: {
                maxWidth: 'none !important',
              },
              maxWidthSm: {
                maxWidth: 'none !important',
              },
              maxWidthXl: {
                maxWidth: 'none !important',
              },
              maxWidthXs: {
                maxWidth: 'none !important',
              },
            },
          
            // Papers com largura controlada por contexto
            MuiPaper: {
              root: {
                backgroundImage: 'none',
                // Aplicar width 100% apenas em contextos específicos
                '&.main-content-paper': {
                  marginLeft: 0,
                  marginRight: 0,
                  width: '100%',
                },
              },
              rounded: {
                borderRadius: 12,
              },
              // Sombras con tinte azulado en vez de negro puro. El negro
              // sobre un fondo claro produce un halo gris sucio; es el rasgo
              // que mas delataba la edad de la interfaz.
              elevation1: {
                boxShadow: tokens.shadow.sm,
              },
              elevation2: {
                boxShadow: tokens.shadow.md,
              },
              elevation3: {
                boxShadow: tokens.shadow.lg,
              }
            },

            // Proteção específica para menus - sem !important
            MuiMenu: {
              paper: {
                width: 'auto',
                maxWidth: '400px',
                minWidth: '180px',
                marginTop: 8, // Usar valor fixo ao invés de theme.spacing(1)
              }
            },

            // Proteção específica para popovers
            MuiPopover: {
              paper: {
                width: 'auto',
                maxWidth: '500px',
              }
            },
            
            // Proteção para diálogos
            MuiDialog: {
              paper: {
                margin: 16, // Usar valor fixo ao invés de theme.spacing(2)
                width: 'calc(100% - 64px)',
                maxWidth: '600px',
              }
            },

            // Inputs melhorados
            MuiTextField: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: mode === "light" ? "#ccc" : "#555",
                    }
                  },
                  '&.Mui-focused': {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: mode === "light" ? brandBorder : primaryColorDark,
                      borderWidth: 2,
                    }
                  }
                }
              }
            },

            // Drawer sem bordas
            MuiDrawer: {
              paper: {
                border: 'none',
              }
            },

            // AppBar transparente
            MuiAppBar: {
              root: {
                boxShadow: 'none',
              }
            }
          },

          mode,
          appLogoLight,
          appLogoDark,
          appLogoFavicon,
          appName,
          calculatedLogoDark: () => {
            if (
              appLogoDark === defaultLogoDark &&
              appLogoLight !== defaultLogoLight
            ) {
              return appLogoLight;
            }
            return appLogoDark;
          },
          calculatedLogoLight: () => {
            if (
              appLogoDark !== defaultLogoDark &&
              appLogoLight === defaultLogoLight
            ) {
              return appLogoDark;
            }
            return appLogoLight;
          },
        };
    },
    [
      appLogoLight,
      appLogoDark,
      appLogoFavicon,
      appName,
      locale,
      mode,
      primaryColorDark,
      primaryColorLight, // Essas são as cores que vêm do tema dinâmico
    ]
  );

  const theme = useMemo(
    () => createTheme(themeOptions, locale),
    [themeOptions, locale]
  );

  // Mesmo tema, traduzido para a v5. As chaves personalizadas
  // (scrollbarStyles, palette.tabHeaderBackground, fancyBackground e afins)
  // vêm junto por serem o mesmo objeto, então um componente que leia
  // theme.palette.tabHeaderBackground funciona nas duas versões.
  //
  // Duas diferenças precisam de tradução:
  //   palette.type -> palette.mode   (renomeado na v5)
  //   overrides    -> components     (formato incompatível; fica só na v4,
  //                                   que é quem tem 251 arquivos)
  const themeV5 = useMemo(() => {
    const { overrides, palette, ...rest } = themeOptions;

    return createThemeV5({
      ...rest,
      palette: {
        ...palette,
        mode: palette.type,
      },
      // El tema v5 no heredaba los overrides: la v4 los declara en
      // "overrides" y la v5 en "components", y esa clave se descarta al
      // traducir. Por eso los botones y textos que vienen de @mui/material
      // seguian usando el primario como color de texto sobre fondo oscuro,
      // donde da 3.05.
      //
      // Se repite aqui la misma correccion, en el formato de la v5.
      components: {
        MuiTypography: {
          styleOverrides: {
            colorPrimary: {
              color: palette.tokens.brand.onSurface,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            textPrimary: {
              color: palette.tokens.brand.onSurface,
            },
            outlinedPrimary: {
              color: palette.tokens.brand.onSurface,
            },
          },
        },
      },
    });
  }, [themeOptions]);

  useEffect(() => {
    window.localStorage.setItem("preferredTheme", mode);
  }, [mode]);

  useEffect(() => {
    getPublicSetting("primaryColorLight")
      .then((color) => {
        // El respaldo era "#0000FF", azul puro: el azul de enlace sin
        // estilar de los noventa, y nadie lo habia elegido. Se sustituye por
        // el violeta de la marca. Sigue ganando lo que configure la empresa.
        setPrimaryColorLight(color || tokens.brandScale[600]);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("primaryColorDark")
      .then((color) => {
        // En oscuro hace falta un tono mas claro que en claro, para que se
        // despegue del fondo. Pero no demasiado: el nivel 300 se veia bien
        // sobre el fondo y en cambio dejaba el texto blanco de los botones en
        // 2.86 de contraste. El 500 es el unico que cumple las dos cosas,
        // 5.85 con blanco encima y 3.05 contra el fondo.
        setPrimaryColorDark(color || tokens.brandScale[500]);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoLight")
      .then((file) => {
        setAppLogoLight(
          file ? getBackendUrl() + "/public/" + file : defaultLogoLight
        );
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoDark")
      .then((file) => {
        setAppLogoDark(
          file ? getBackendUrl() + "/public/" + file : defaultLogoDark
        );
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appLogoFavicon")
      .then((file) => {
        setAppLogoFavicon(
          file ? getBackendUrl() + "/public/" + file : defaultLogoFavicon
        );
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("appName")
      .then((name) => {
        setAppName(name || "Multi100");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
        setAppName("Multi100");
      });

    // Moneda de la instalacion. Manda el servidor sobre lo que hubiera
    // guardado el navegador; si falla la lectura no se toca nada y se
    // sigue con la ultima conocida.
    getPublicSetting("currency")
      .then((code) => {
        applyInstallationCurrency(code);
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEBUG opcional: rastrear elementos que capturam cliques (ativar com localStorage.setItem('debugPointer','1'))
  useEffect(() => {
    if (localStorage.getItem('debugPointer') !== '1') return;
    const getPath = (el) => {
      try {
        const path = [];
        while (el && el.nodeType === 1 && path.length < 10) {
          const name = el.nodeName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/).slice(0,3).join('.')}` : '';
          path.unshift(`${name}${id}${cls}`);
          el = el.parentElement;
        }
        return path.join(' > ');
      } catch { return '(path-error)'; }
    };
    const onPointer = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      // eslint-disable-next-line no-console
      console.log('[debugPointer]', { x: e.clientX, y: e.clientY, target: e.target, topEl: el, path: getPath(el) });
    };
    window.addEventListener('pointerdown', onPointer, true);
    return () => window.removeEventListener('pointerdown', onPointer, true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--primaryColor",
      mode === "light" ? primaryColorLight : primaryColorDark
    );
  }, [primaryColorLight, primaryColorDark, mode]);

  useEffect(() => {
    async function fetchVersionData() {
      try {
        const response = await api.get("/version");
        const { data } = response;
        const currentVersion = window.localStorage.getItem("frontendVersion");
        
        // Se a versão mudou, notificar o usuário
        if (currentVersion && currentVersion !== data.version) {
          console.log(`Nova versão detectada: ${data.version} (anterior: ${currentVersion})`);
          
          // Mostrar notificação para o usuário
          const updateApp = window.confirm(
            "Uma nova versão da aplicação está disponível. Deseja atualizar agora?"
          );
          
          if (updateApp) {
            window.localStorage.setItem("frontendVersion", data.version);
            window.location.reload(true); // Force reload from server
          }
        } else {
          window.localStorage.setItem("frontendVersion", data.version);
        }
      } catch (error) {
        console.log("Error fetching version data", error);
      }
    }
    
    // Verificar versão ao carregar
    fetchVersionData();
    
    // Verificar versão periodicamente (a cada 5 minutos)
    const versionCheckInterval = setInterval(fetchVersionData, 5 * 60 * 1000);
    
    return () => {
      clearInterval(versionCheckInterval);
    };
  }, []);

  return (
    <>
      <Favicon
        url={
          appLogoFavicon
            ? appLogoFavicon
            : defaultLogoFavicon
        }
      />
      <ColorModeContext.Provider value={{ colorMode }}>
        {/*
          Os dois ThemeProvider aninhados são propositais: cada versão do MUI
          tem o seu contexto, e sem os dois metade da interface ignora o tema.
          Sai quando a migração para a v5 estiver completa.
        */}
        <ThemeProvider theme={theme}>
          {/*
            Dentro do ThemeProvider de proposito: e daqui que o CssBaseline
            tira a tipografia, o fundo e a cor de texto que aplica ao body.
            Fora dele usava o tema por omissao do MUI.
          */}
          <CssBaseline />
          <ThemeProviderV5 theme={themeV5}>
            <QueryClientProvider client={queryClient}>
              <ActiveMenuProvider>
                <Routes />
              </ActiveMenuProvider>
            </QueryClientProvider>
          </ThemeProviderV5>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
};

export default App;
