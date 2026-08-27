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
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { ActiveMenuProvider } from "./context/ActiveMenuContext";
import Favicon from "react-favicon";
import { getBackendUrl } from "./config";
import Routes from "./routes";
import defaultLogoLight from "./assets/logo.png";
import defaultLogoDark from "./assets/logo-black.png";
import defaultLogoFavicon from "./assets/favicon.ico";
import useSettings from "./hooks/useSettings";

import "./styles/animations.css";

const queryClient = new QueryClient();

const App = () => {
  const [locale, setLocale] = useState();
  const appColorLocalStorage =
    localStorage.getItem("primaryColorLight") ||
    localStorage.getItem("primaryColorDark") ||
    "#065183";
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
    () =>
      ({
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
            h1: {
              fontWeight: 700,
              letterSpacing: '-0.025em',
            },
            h2: {
              fontWeight: 700,
              letterSpacing: '-0.025em',
            },
            h3: {
              fontWeight: 600,
              letterSpacing: '-0.025em',
            },
            h4: {
              fontWeight: 600,
              letterSpacing: '-0.025em',
            },
            h5: {
              fontWeight: 600,
              letterSpacing: '-0.025em',
            },
            h6: {
              fontWeight: 600,
              letterSpacing: '-0.025em',
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
                letterSpacing: '0.025em',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                }
              },
              contained: {
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                }
              }
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
              elevation1: {
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              },
              elevation2: {
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              },
              elevation3: {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
                      borderColor: mode === "light" ? primaryColorLight : primaryColorDark,
                      borderWidth: 2,
                    }
                  }
                }
              }
            },

            // Tabs usando cor do tema
            MuiTab: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: '0.025em',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: mode === "light"
                    ? `${primaryColorLight}08`
                    : `${primaryColorDark}08`,
                },
                '&.Mui-selected': {
                  color: mode === "light" ? primaryColorLight : primaryColorDark,
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
        }),
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
    });
  }, [themeOptions]);

  useEffect(() => {
    window.localStorage.setItem("preferredTheme", mode);
  }, [mode]);

  useEffect(() => {
    getPublicSetting("primaryColorLight")
      .then((color) => {
        setPrimaryColorLight(color || "#0000FF");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });
    getPublicSetting("primaryColorDark")
      .then((color) => {
        setPrimaryColorDark(color || "#39ACE7");
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
