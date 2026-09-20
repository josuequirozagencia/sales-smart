import React, { useState, useContext, useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { i18n, soloIdioma, IDIOMA_POR_DEFECTO } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";
import useSettings from "../../hooks/useSettings";
import IconButton from "@material-ui/core/IconButton";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import InputAdornment from "@material-ui/core/InputAdornment";
import { Helmet } from "react-helmet";
import BRFlag from "../../assets/brazil.png";
import USFlag from "../../assets/unitedstates.png";
import ESFlag from "../../assets/esspain.png";
import ARFlag from "../../assets/arabe.png";
import defaultLogoLight from "../../assets/logo.png";
import clsx from "clsx";
import { getBackendUrl } from "../../config";

const languageOptions = [
  { value: "pt-BR", label: "Português", icon: BRFlag },
  { value: "en", label: "English", icon: USFlag },
  { value: "es", label: "Español", icon: ESFlag },
  { value: "ar", label: "عربي", icon: ARFlag },
];

const useStyles = makeStyles((theme) => ({
  // Aviso de acceso bloqueado. Fijo, no pasajero: el usuario no lo
  // resuelve reintentando y tiene que poder leerlo con calma.
  avisoBloqueo: {
    width: "100%",
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: theme.palette.tokens.radius.md,
    backgroundColor: theme.palette.tokens.semantic.warning.soft,
    color: theme.palette.tokens.semantic.warning.text,
    fontSize: "0.875rem",
    lineHeight: 1.5,
  },
  avisoSoporte: {
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: "1px solid currentColor",
    opacity: 0.9,
  },
  root: {
    width: "100%",
    height: "100vh",
    // dvh descuenta las barras del navegador movil; donde no existe se queda
    // el 100vh de arriba.
    "@supports (height: 100dvh)": {
      height: "100dvh",
    },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // El centrado vertical lo da el margin auto de la tarjeta, no
    // justifyContent: con "center", cuando la tarjeta no cabe se sale por
    // arriba y esa parte ya no se alcanza con el scroll.
    justifyContent: "flex-start",
    textAlign: "center",
    // Arriba queda sitio para el idioma y el tema, que van fijos.
    padding: "80px 16px 32px",
    margin: "0",
    boxSizing: "border-box",
    // Scroll vertical propio (el body de la aplicacion tiene overflow hidden):
    // antes era overflow hidden y, en un movil con el teclado abierto o en
    // horizontal, el boton quedaba fuera de la pantalla sin forma de llegar.
    overflowX: "hidden",
    overflowY: "auto",
    // Escritorio: tarjeta a la derecha, como antes, pero dentro del flujo y no
    // en posicion absoluta, para que tambien pueda desplazarse en ventanas bajas.
    [theme.breakpoints.up("md")]: {
      alignItems: "flex-end",
      padding: "80px 8% 32px",
    },
    // Fondo con el color de MARCA, no un azul fijo.
    //
    // Se deriva del primario configurado en Ajustes > Whitelabel, asi que
    // una empresa que cambie su color ve tambien cambiar esta pantalla. El
    // sistema de tokens solo ofrece oscurecer, de ahi que el degradado vaya
    // del tono activo al primario en vez de abrir hacia un tono claro.
    background: `linear-gradient(135deg, ${theme.palette.tokens.brand.primaryActive} 0%, ${theme.palette.tokens.brand.primary} 100%)`,
    position: "relative",

    // Padrão de pontos no fundo
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundImage: `
        radial-gradient(circle at 25% 25%, rgba(255,255,255,0.05) 1px, transparent 1px),
        radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 1px, transparent 1px)
      `,
      backgroundSize: "50px 50px",
      animation: "$float 20s ease-in-out infinite",
    },
  },

  "@keyframes float": {
    "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
    "50%": { transform: "translateY(-10px) rotate(180deg)" },
  },

  // Container ajustado - desktop à direita, mobile centralizado
  // Ya no es un <Container> de MUI: el tema global le quita el padding con
  // !important a todos (App.js, MuiContainer) y en el movil la tarjeta llegaba
  // de borde a borde de la pantalla. El margen lo da ahora la raiz.
  containerLogin: {
    width: "100%",
    maxWidth: "420px",
    position: "relative",
    zIndex: 10,
    marginTop: "auto",
    marginBottom: "auto",
    flexShrink: 0,
  },

  paper: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: `
      0 20px 40px rgba(0, 0, 0, 0.1),
      0 1px 0 rgba(255, 255, 255, 0.2) inset,
      0 0 0 1px rgba(255, 255, 255, 0.1)
    `,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 30px",
    borderRadius: "20px",
    maxWidth: "420px",
    width: "100%",
    margin: "0 auto",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    animation: "$slideInRight 0.8s cubic-bezier(0.4, 0, 0.2, 1)",

    [theme.breakpoints.down("sm")]: {
      animation: "$slideInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
      borderRadius: "16px",
      padding: "28px 20px 20px",
    },
  },

  "@keyframes slideInRight": {
    from: {
      opacity: 0,
      transform: "translateX(50px)",
    },
    to: {
      opacity: 1,
      transform: "translateX(0)",
    },
  },

  "@keyframes slideInUp": {
    from: {
      opacity: 0,
      transform: "translateY(30px)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
  },

  avatar: {
    margin: theme.spacing(1),
    backgroundColor: theme.palette.tokens.brand.primary,
    // El icono de dentro se calcula sobre el fondo, no se fija blanco: si
    // una empresa elige un primario claro, el blanco desapareceria.
    color: theme.palette.tokens.brand.onPrimary,
  },

  form: {
    width: "100%",
    marginTop: theme.spacing(1),
  },

  submit: {
    margin: theme.spacing(3, 0, 2),
    background: `linear-gradient(45deg, ${theme.palette.tokens.brand.primary}, ${theme.palette.tokens.brand.primaryActive})`,
    color: "white",
    borderRadius: "12px",
    padding: "12px 0",
    fontSize: "16px",
    fontWeight: 600,
    textTransform: "none",
    // Sombra del sistema, no una tintada con el azul que ya no existe.
    boxShadow: theme.palette.tokens.shadow.md,
    border: "none",
    transition: "all 0.3s ease",
    "&:hover": {
      background: `linear-gradient(45deg, ${theme.palette.tokens.brand.primaryHover}, ${theme.palette.tokens.brand.primaryActive})`,
      transform: "translateY(-2px)",
      boxShadow: theme.palette.tokens.shadow.lg,
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },

  powered: {
    color: "white",
  },

  // Logo - mantendo o sistema original
  logoImg: {
    width: "100%",
    maxWidth: "280px",
    height: "auto",
    maxHeight: "80px",
    margin: "0 auto 20px auto",
    [theme.breakpoints.down("xs")]: {
      maxWidth: "220px",
      maxHeight: "56px",
      marginBottom: "8px",
    },
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
    // Sempre usa logo.png na página de login
    content: "url(" + defaultLogoLight + ")",
  },

  // Boton de tema: fuera de la tarjeta, fijo arriba a la derecha, como el
  // idioma a la izquierda. Dentro de la tarjeta, en el movil, tapaba el logo.
  iconButton: {
    position: "fixed",
    top: 20,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    padding: 8,
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(0, 0, 0, 0.15)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    color: "#374151",
    transition: "all 0.3s ease",
    "&:hover": {
      background: "rgba(255, 255, 255, 1)",
      transform: "scale(1.05)",
    },
    [theme.breakpoints.down("xs")]: {
      top: 16,
      right: 16,
    },
  },

  // Campos de input melhorados mas compatíveis
  textField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(10px)",
      transition: "all 0.3s ease",
      color: "#1f2937", // Cor escura para o texto digitado
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
      },
      "&.Mui-focused": {
        backgroundColor: "rgba(255, 255, 255, 1)",
        // Halo de foco en el color de marca, con la opacidad en el propio
        // borde: es lo que senala donde se esta escribiendo.
        boxShadow: `0 0 0 3px ${theme.palette.tokens.brand.primary}22`,
      },
      // 48px de alto y letra de 16px. El tema global deja los campos en 38px
      // con la etiqueta calculada para 56 (quedaba pegada al borde inferior),
      // y con menos de 16px Safari en iPhone amplia la pagina al tocar el campo.
      "& .MuiOutlinedInput-input": {
        paddingTop: 14,
        paddingBottom: 14,
        fontSize: 16,
      },
      "& input": {
        color: "#1f2937", // Garante que o texto do input seja escuro
        "&::placeholder": {
          color: "#9ca3af",
          opacity: 1,
        },
      },
      "& fieldset": {
        borderColor: theme.palette.tokens.border.border,
      },
      "&:hover fieldset": {
        borderColor: theme.palette.tokens.border.strong,
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.tokens.brand.primary,
        borderWidth: "2px",
      },
    },
    "& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)": {
      transform: "translate(14px, 15px) scale(1)",
    },
    "& .MuiInputLabel-root": {
      color: "#6b7280",
      fontWeight: 500,
      "&.Mui-focused": {
        color: theme.palette.tokens.brand.onSurface,
      },
    },
  },

  // Seletor de idioma - versão simplificada
  languageSelector: {
    position: "fixed",
    top: "20px",
    left: "20px",
    [theme.breakpoints.down("xs")]: {
      top: "16px",
      left: "16px",
    },
    zIndex: 1000,
    background: theme.mode === "light"
      ? "rgba(255, 255, 255, 0.9)"
      : "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    borderRadius: "12px",
    border: theme.mode === "light"
      ? "1px solid rgba(0, 0, 0, 0.15)"
      : "1px solid rgba(255, 255, 255, 0.2)",
    padding: "8px 12px",
    boxShadow: theme.mode === "light"
      ? "0 2px 8px rgba(0, 0, 0, 0.1)"
      : "none",
  },

  // Link de registro
  registerLink: {
    color: theme.palette.tokens.brand.onSurface,
    textDecoration: "none",
    fontWeight: 600,
    transition: "all 0.3s ease",
    "&:hover": {
      color: theme.palette.tokens.brand.primaryHover,
      textDecoration: "underline",
    },
  },

  // Estilos para o dropdown de idiomas
  languageDropdown: {
    display: "flex",
    alignItems: "center",
    background: "none",
    border: "none",
    color: theme.mode === "light" ? "#1f2937" : "white",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    gap: "8px",
    transition: "opacity 0.3s ease",
    "&:hover": {
      opacity: 0.8,
    },
  },

  languageOptions: {
    position: "absolute",
    top: "100%",
    left: "0",
    marginTop: "8px",
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "8px",
    zIndex: 1000,
    minWidth: "140px",
  },

  languageOption: {
    background: "none",
    border: "none",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "8px 12px",
    textAlign: "left",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      background: theme.palette.tokens.surface.surfaceSecondary,
      color: theme.palette.tokens.brand.onSurface,
    },
  },

  flagIcon: {
    width: 20,
    height: 15,
    borderRadius: 2,
  },
}));

const Login = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const { appLogoFavicon, appName, mode } = colorMode;
  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  // Motivo por el que no se puede entrar, si lo hay. Se muestra fijo y no
  // como aviso pasajero: son situaciones que el usuario no arregla
  // reintentando, y necesita leer que hacer.
  //
  // Llega del CONTEXTO y no de un estado de aqui: esta pantalla se
  // desmonta mientras dura el intento —Route pinta la carga— y volveria
  // montada de cero con el aviso perdido. Ver la nota en useAuth.
  const [soporte, setSoporte] = useState({ email: "", phone: "", note: "" });
  const { getPublicSetting } = useSettings();
  const { handleLogin, bloqueoAcceso: bloqueo, limpiarBloqueo } = useContext(AuthContext);

  const [open, setOpen] = useState(false);
  const ref = useRef();
  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);
  const [backgroundLight, setBackgroundLight] = useState("");
  const [backgroundDark, setBackgroundDark] = useState("");

  const getCompanyIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get("companyId");
    return companyId ? parseInt(companyId) : null;
  };

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handlSubmit = (e) => {
    e.preventDefault();
    limpiarBloqueo();
    // El motivo lo guarda handleLogin en el contexto; aqui solo hay que
    // evitar que el rechazo quede sin recoger.
    handleLogin(user).catch(() => {});
  };

  useEffect(() => {
    const companyId = getCompanyIdFromUrl();

    // Datos de soporte para el aviso de prueba vencida. Si fallan, el
    // mensaje sale igual sin ellos: no puede depender de esto.
    ["supportEmail", "supportPhone", "supportNote"].forEach((clave) => {
      getPublicSetting(clave, companyId)
        .then((valor) =>
          setSoporte((s) => ({
            ...s,
            [clave.replace("support", "").toLowerCase()]: valor || "",
          }))
        )
        .catch(() => {});
    });

    getPublicSetting("userCreation", companyId)
      .then((data) => {
        setAllowSignup(data === "enabled");
      })
      .catch((error) => {
        console.log("Error reading setting", error);
      });

    getPublicSetting("enabledLanguages", companyId)
      .then((langs) => {
        let arr = ["pt-BR", "en"];
        try {
          if (langs) arr = JSON.parse(langs);
        } catch {}
        setEnabledLanguages(arr);
      })
      .catch(() => {
        setEnabledLanguages(["pt-BR", "en"]);
      });

    getPublicSetting("appLogoBackgroundLight", companyId)
      .then((bgLight) => {
        if (bgLight) {
          setBackgroundLight(getBackendUrl() + "/public/" + bgLight);
        } else {
          setBackgroundLight("");
        }
      })
      .catch(() => {
        setBackgroundLight("");
      });

    getPublicSetting("appLogoBackgroundDark", companyId)
      .then((bgDark) => {
        if (bgDark) {
          setBackgroundDark(getBackendUrl() + "/public/" + bgDark);
        } else {
          setBackgroundDark("");
        }
      })
      .catch(() => {
        setBackgroundDark("");
      });
  }, []);

  // Se compara por el idioma BASE. i18n.language conserva la variante
  // del navegador —'es-419'—, que no coincide con el valor 'es' de la
  // lista, y entonces caia en languageOptions[0], que es portugues: la
  // interfaz salia en espanol pero el selector decia Portugues.
  const current =
    languageOptions.find(
      (opt) => soloIdioma(opt.value) === soloIdioma(i18n.language)
    ) ||
    languageOptions.find((opt) => soloIdioma(opt.value) === IDIOMA_POR_DEFECTO) ||
    languageOptions[0];

  const handleSelect = (opt) => {
    i18n.changeLanguage(opt.value);
    localStorage.setItem("language", opt.value);
    setOpen(false);
    window.location.reload();
  };

  // Fondo de la pantalla.
  //
  // Si la empresa subio una imagen en Ajustes > Whitelabel, manda esa. Si
  // no, un degradado con el color de MARCA, que antes era un azul fijo sin
  // relacion con el color configurado.
  //
  // El respaldo anterior era `theme.palette.light`, que NO es un color sino
  // un objeto {main}: String() lo convertia en "[object Object]", un valor
  // de CSS invalido que el navegador descartaba. El fondo acababa siendo el
  // que hubiera debajo, y nadie se enteraba porque no da error.
  const degradadoDeMarca =
    `linear-gradient(135deg, ${theme.palette.tokens.brand.primaryActive} 0%, ` +
    `${theme.palette.tokens.brand.primary} 100%)`;

  let finalBackground;
  if (mode === "light") {
    finalBackground = backgroundLight
      ? `url(${backgroundLight})`
      : degradadoDeMarca;
  } else {
    finalBackground = backgroundDark
      ? `url(${backgroundDark})`
      : degradadoDeMarca;
  }

  finalBackground = String(finalBackground || degradadoDeMarca);

  // Tanto una imagen como un degradado se pintan con backgroundImage; solo
  // un color plano iria en backgroundColor, y ya no queda ninguno.
  const fondoEsImagen =
    finalBackground.includes("url(") || finalBackground.includes("gradient(");


  return (
    <>
      <Helmet>
        <title>{appName || "Multi100"}</title>
        <link rel="icon" href={appLogoFavicon || "/default-favicon.ico"} />
      </Helmet>

      <div className={clsx(classes.root, "login-page")}
      style={{
          backgroundColor: fondoEsImagen ? "transparent" : finalBackground,
          backgroundImage: fondoEsImagen ? finalBackground : "none",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Seletor de idioma */}
        <div
          ref={ref}
          className={classes.languageSelector}
        >
          <button
            onClick={() => setOpen((o) => !o)}
            className={classes.languageDropdown}
          >
            <img
              src={current.icon}
              alt={current.label}
              className={classes.flagIcon}
            />
            {current.label}
            <span>▾</span>
          </button>

          {open && (
            <div className={classes.languageOptions}>
              {languageOptions
                .filter((opt) =>
                  enabledLanguages.some(
                    (l) => soloIdioma(l) === soloIdioma(opt.value)
                  )
                )
                .map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    className={classes.languageOption}
                  >
                    <img
                      src={opt.icon}
                      alt={opt.label}
                      className={classes.flagIcon}
                    />
                    {opt.label}
                  </button>
                ))}
            </div>
          )}
        </div>

        <IconButton
          className={classes.iconButton}
          onClick={colorMode.toggleColorMode}
        >
          {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>

        <main className={classes.containerLogin}>
          <CssBaseline />
          <div className={classes.paper}>
            <div>
              <img className={classes.logoImg} alt="logo" />
            </div>

            <form className={classes.form} noValidate onSubmit={handlSubmit}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label={i18n.t("login.form.email")}
                name="email"
                value={user.email}
                onChange={handleChangeInput}
                autoComplete="email"
                autoFocus
                className={classes.textField}
              />
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="password"
                label={i18n.t("login.form.password")}
                type={showPassword ? "text" : "password"}
                id="password"
                value={user.password}
                onChange={handleChangeInput}
                autoComplete="current-password"
                className={classes.textField}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                        style={{ color: "#6b7280" }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                className={classes.submit}
              >
                {i18n.t("login.buttons.submit")}
              </Button>

              {bloqueo && (
                <div className={classes.avisoBloqueo}>
                  {i18n.t(`backendErrors.${bloqueo}`)}
                  {/* Los datos de contacto solo se muestran cuando sirven
                      de algo: en el resto de bloqueos no hay nada que
                      gestionar con soporte. */}
                  {bloqueo === "ERR_TRIAL_EXPIRED" &&
                    (soporte.email || soporte.phone || soporte.note) && (
                      <div className={classes.avisoSoporte}>
                        {soporte.note && <div>{soporte.note}</div>}
                        {soporte.email && <div>{soporte.email}</div>}
                        {soporte.phone && <div>{soporte.phone}</div>}
                      </div>
                    )}
                </div>
              )}
              {/* Recuperar contrasena: siempre visible. No depende de que el
                  registro publico este abierto, porque quien ya tiene cuenta
                  necesita poder recuperarla igualmente. */}
              <Grid container justifyContent="center">
                <Grid item>
                  <Link
                    href="#"
                    variant="body2"
                    component={RouterLink}
                    to="/forgot-password"
                    className={classes.registerLink}
                  >
                    {i18n.t("login.buttons.forgotPassword")}
                  </Link>
                </Grid>
              </Grid>
              {allowSignup && (
                <Grid container justifyContent="center">
                  <Grid item>
                    <Link
                      href="#"
                      variant="body2"
                      component={RouterLink}
                      to="/signup"
                      className={classes.registerLink}
                    >
                      {i18n.t("login.buttons.register")}
                    </Link>
                  </Grid>
                </Grid>
              )}
            </form>
          </div>
        </main>
      </div>
    </>
  );
};

export default Login;