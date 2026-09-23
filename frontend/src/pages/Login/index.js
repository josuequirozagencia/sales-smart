import React, { useState, useContext, useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";
import useSettings from "../../hooks/useSettings";
import IconButton from "@material-ui/core/IconButton";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import EmailOutlinedIcon from "@material-ui/icons/EmailOutlined";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
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
  { value: "es", label: "Spanish", icon: ESFlag },
  { value: "ar", label: "عربي", icon: ARFlag },
];

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "24px 16px",
    margin: "0",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
    // Degradado profundo con malla de luz
    background:
      "radial-gradient(1200px 600px at 15% 10%, rgba(96,165,250,0.35), transparent 60%)," +
      "radial-gradient(900px 500px at 85% 90%, rgba(37,99,235,0.35), transparent 60%)," +
      "linear-gradient(160deg, #0b1e4b 0%, #123a8f 45%, #1d4ed8 100%)",
  },

  // Orbes flotantes decorativos
  orb: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(70px)",
    opacity: 0.5,
    pointerEvents: "none",
    animation: "$drift 14s ease-in-out infinite",
  },
  orbOne: {
    width: 380,
    height: 380,
    top: "-8%",
    left: "-6%",
    background: "#60a5fa",
  },
  orbTwo: {
    width: 320,
    height: 320,
    bottom: "-10%",
    right: "-4%",
    background: "#2563eb",
    animationDelay: "-7s",
  },

  "@keyframes drift": {
    "0%, 100%": { transform: "translate(0, 0) scale(1)" },
    "50%": { transform: "translate(30px, -25px) scale(1.08)" },
  },

  containerLogin: {
    padding: "0",
    maxWidth: "420px",
    width: "100%",
    position: "relative",
    zIndex: 10,
  },

  paper: {
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow:
      "0 24px 60px rgba(2, 12, 40, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "44px 36px 36px",
    borderRadius: "24px",
    width: "100%",
    border: "1px solid rgba(255, 255, 255, 0.16)",
    animation: "$fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1)",

    [theme.breakpoints.down("sm")]: {
      borderRadius: "18px",
      padding: "36px 24px 28px",
    },
  },

  "@keyframes fadeUp": {
    from: { opacity: 0, transform: "translateY(24px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },

  // Marca
  logoImg: {
    width: "100%",
    maxWidth: "240px",
    height: "auto",
    maxHeight: "72px",
    margin: "0 auto 6px auto",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
    content: "url(" + defaultLogoLight + ")",
  },

  welcome: {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "1.35rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: "10px 0 4px",
  },

  subtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "0.9rem",
    fontWeight: 400,
    margin: "0 0 8px",
  },

  form: {
    width: "100%",
    marginTop: theme.spacing(2),
  },

  submit: {
    margin: theme.spacing(3, 0, 2),
    background: "linear-gradient(45deg, #3b82f6, #2563eb)",
    color: "#fff",
    borderRadius: "12px",
    padding: "13px 0",
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "none",
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.45)",
    border: "none",
    transition: "all 0.25s ease",
    "&:hover": {
      background: "linear-gradient(45deg, #2563eb, #1d4ed8)",
      transform: "translateY(-2px)",
      boxShadow: "0 12px 28px rgba(37, 99, 235, 0.55)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
  },

  // Botón de tema
  iconButton: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    color: "#fff",
    padding: 8,
    transition: "all 0.25s ease",
    "&:hover": {
      background: "rgba(255, 255, 255, 0.2)",
      transform: "scale(1.06)",
    },
  },

  // Campos sobre fondo oscuro / cristal
  textField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      backgroundColor: "rgba(255, 255, 255, 0.07)",
      transition: "all 0.25s ease",
      color: "#f3f4f6",
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.11)",
      },
      "&.Mui-focused": {
        backgroundColor: "rgba(255, 255, 255, 0.13)",
        boxShadow: "0 0 0 3px rgba(96, 165, 250, 0.25)",
      },
      "& input": {
        color: "#f9fafb",
        "&::placeholder": {
          color: "rgba(255,255,255,0.45)",
          opacity: 1,
        },
      },
      "& fieldset": {
        borderColor: "rgba(255, 255, 255, 0.22)",
      },
      "&:hover fieldset": {
        borderColor: "rgba(255, 255, 255, 0.4)",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#60a5fa",
        borderWidth: "2px",
      },
    },
    "& .MuiInputLabel-root": {
      color: "rgba(255, 255, 255, 0.65)",
      fontWeight: 500,
      "&.Mui-focused": {
        color: "#93c5fd",
      },
    },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": {
      color: "rgba(255, 255, 255, 0.55)",
    },
  },

  // Seletor de idioma
  languageSelector: {
    position: "fixed",
    top: "20px",
    left: "20px",
    zIndex: 1000,
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(12px)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "8px 12px",
  },

  registerLink: {
    color: "#93c5fd",
    textDecoration: "none",
    fontWeight: 600,
    transition: "all 0.25s ease",
    "&:hover": {
      color: "#bfdbfe",
      textDecoration: "underline",
    },
  },

  footer: {
    marginTop: 18,
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: "0.78rem",
    position: "relative",
    zIndex: 10,
  },

  languageDropdown: {
    display: "flex",
    alignItems: "center",
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    gap: "8px",
    transition: "opacity 0.25s ease",
    "&:hover": {
      opacity: 0.85,
    },
  },

  languageOptions: {
    position: "absolute",
    top: "100%",
    left: "0",
    marginTop: "8px",
    background: "rgba(17, 34, 74, 0.92)",
    backdropFilter: "blur(20px)",
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    padding: "6px",
    zIndex: 1000,
    minWidth: "150px",
  },

  languageOption: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.85)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "9px 12px",
    textAlign: "left",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      background: "rgba(96, 165, 250, 0.18)",
      color: "#fff",
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
  const { getPublicSetting } = useSettings();
  const { handleLogin } = useContext(AuthContext);

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
    handleLogin(user);
  };

  useEffect(() => {
    const companyId = getCompanyIdFromUrl();

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
        setBackgroundLight(bgLight ? getBackendUrl() + "/public/" + bgLight : "");
      })
      .catch(() => {
        setBackgroundLight("");
      });

    getPublicSetting("appLogoBackgroundDark", companyId)
      .then((bgDark) => {
        setBackgroundDark(bgDark ? getBackendUrl() + "/public/" + bgDark : "");
      })
      .catch(() => {
        setBackgroundDark("");
      });
  }, []);

  // Cerrar dropdown de idiomas al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current =
    languageOptions.find((opt) => opt.value === i18n.language) ||
    languageOptions[0];

  const handleSelect = (opt) => {
    i18n.changeLanguage(opt.value);
    localStorage.setItem("language", opt.value);
    setOpen(false);
    window.location.reload();
  };

  // Fondo personalizado (configuración de la empresa) tiene prioridad
  let customBackground = null;
  const bgSetting = mode === "light" ? backgroundLight : backgroundDark;
  if (bgSetting) {
    customBackground = `url(${bgSetting})`;
  }

  return (
    <>
      <Helmet>
        <title>{appName || "Multi100"}</title>
        <link rel="icon" href={appLogoFavicon || "/default-favicon.ico"} />
      </Helmet>

      <div
        className={clsx(classes.root, "login-page")}
        style={
          customBackground
            ? {
                backgroundImage: customBackground,
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {/* Orbes decorativos solo con el fondo por defecto */}
        {!customBackground && (
          <>
            <div className={clsx(classes.orb, classes.orbOne)} />
            <div className={clsx(classes.orb, classes.orbTwo)} />
          </>
        )}

        {/* Seletor de idioma */}
        <div ref={ref} className={classes.languageSelector}>
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
                .filter((opt) => enabledLanguages.includes(opt.value))
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

        <Container
          component="main"
          maxWidth="xs"
          className={classes.containerLogin}
        >
          <CssBaseline />
          <div className={classes.paper}>
            <IconButton
              className={classes.iconButton}
              onClick={colorMode.toggleColorMode}
            >
              {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>

            <div>
              <img className={classes.logoImg} alt="logo" />
            </div>

            <h1 className={classes.welcome}>
              {i18n.t("login.form.title") || appName || "Bienvenido"}
            </h1>
            <p className={classes.subtitle}>
              {i18n.t("login.form.subtitle") ||
                "Ingresa tus credenciales para continuar"}
            </p>

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
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon />
                    </InputAdornment>
                  ),
                }}
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
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                        style={{ color: "rgba(255,255,255,0.55)" }}
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
        </Container>

        <div className={classes.footer}>
          © {new Date().getFullYear()} {appName || "Multi100"}
        </div>
      </div>
    </>
  );
};

export default Login;
