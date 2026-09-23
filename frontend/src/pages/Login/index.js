import React, { useState, useContext, useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import EmailOutlinedIcon from "@material-ui/icons/EmailOutlined";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import CheckIcon from "@material-ui/icons/Check";
import { Helmet } from "react-helmet";
import clsx from "clsx";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";
import useSettings from "../../hooks/useSettings";
import BRFlag from "../../assets/brazil.png";
import USFlag from "../../assets/unitedstates.png";
import ESFlag from "../../assets/esspain.png";
import ARFlag from "../../assets/arabe.png";
import defaultLogoLight from "../../assets/logo.png";
import { getBackendUrl } from "../../config";

const languageOptions = [
  { value: "pt-BR", label: "Português", icon: BRFlag },
  { value: "en", label: "English", icon: USFlag },
  { value: "es", label: "Español", icon: ESFlag },
  { value: "ar", label: "العربية", icon: ARFlag },
];

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    overflowY: "auto",
    boxSizing: "border-box",
    position: "relative",
    padding: "76px 20px 28px",
    background: mode => mode === "dark"
      ? "linear-gradient(145deg, #071426 0%, #0b2447 54%, #123b72 100%)"
      : "linear-gradient(145deg, #eaf2ff 0%, #dbeafe 48%, #bfdbfe 100%)",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: mode => mode === "dark"
        ? "linear-gradient(115deg, rgba(255,255,255,.045), transparent 38%)"
        : "linear-gradient(115deg, rgba(255,255,255,.72), transparent 42%)",
    },
    [theme.breakpoints.down("xs")]: {
      justifyContent: "flex-start",
      padding: "68px 16px 22px",
    },
  },
  customOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(5, 18, 38, .62)",
    pointerEvents: "none",
  },
  containerLogin: {
    width: "100%",
    maxWidth: 440,
    padding: 0,
    position: "relative",
    zIndex: 2,
  },
  paper: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    position: "relative",
    padding: "42px 40px 34px",
    borderRadius: 14,
    border: mode => mode === "dark" ? "1px solid rgba(255,255,255,.12)" : "1px solid rgba(15,23,42,.09)",
    backgroundColor: mode => mode === "dark" ? "rgba(10,24,45,.94)" : "rgba(255,255,255,.97)",
    boxShadow: mode => mode === "dark" ? "0 24px 64px rgba(0,0,0,.34)" : "0 24px 64px rgba(30,64,175,.17)",
    animation: "$enter .45s cubic-bezier(.22,1,.36,1)",
    [theme.breakpoints.down("xs")]: {
      padding: "34px 22px 28px",
      borderRadius: 12,
    },
    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
  },
  "@keyframes enter": {
    from: { opacity: 0, transform: "translateY(12px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  themeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    color: mode => mode === "dark" ? "#cbd5e1" : "#475569",
    backgroundColor: mode => mode === "dark" ? "rgba(255,255,255,.06)" : "#f1f5f9",
    border: mode => mode === "dark" ? "1px solid rgba(255,255,255,.1)" : "1px solid #e2e8f0",
    "&:hover": { backgroundColor: mode => mode === "dark" ? "rgba(255,255,255,.11)" : "#e2e8f0" },
    "&:focus-visible": { outline: "3px solid rgba(59,130,246,.32)", outlineOffset: 2 },
  },
  brand: { minHeight: 64, display: "flex", justifyContent: "center", alignItems: "center", margin: "2px 44px 18px" },
  logoImg: { display: "block", maxWidth: "100%", width: "auto", height: "auto", maxHeight: 64, objectFit: "contain" },
  welcome: {
    color: mode => mode === "dark" ? "#f8fafc" : "#0f172a",
    fontSize: "1.65rem",
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: 0,
    textAlign: "center",
    margin: "0 0 8px",
  },
  subtitle: {
    color: mode => mode === "dark" ? "#94a3b8" : "#64748b",
    fontSize: ".94rem",
    lineHeight: 1.55,
    textAlign: "center",
    margin: "0 0 18px",
  },
  form: { width: "100%" },
  textField: {
    "& .MuiOutlinedInput-root": {
      minHeight: 54,
      borderRadius: 8,
      color: mode => mode === "dark" ? "#f8fafc" : "#0f172a",
      backgroundColor: mode => mode === "dark" ? "rgba(255,255,255,.045)" : "#f8fafc",
      transition: "background-color .18s ease, box-shadow .18s ease",
      "& fieldset": { borderColor: mode => mode === "dark" ? "rgba(255,255,255,.18)" : "#cbd5e1" },
      "&:hover fieldset": { borderColor: mode => mode === "dark" ? "#64748b" : "#94a3b8" },
      "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(37,99,235,.16)" },
      "&.Mui-focused fieldset": { borderColor: "#2563eb", borderWidth: 1 },
      "&.Mui-error fieldset": { borderColor: "#dc2626" },
      "& input:-webkit-autofill": {
        WebkitTextFillColor: mode => mode === "dark" ? "#f8fafc" : "#0f172a",
        WebkitBoxShadow: mode => mode === "dark" ? "0 0 0 100px #14243a inset" : "0 0 0 100px #f8fafc inset",
      },
    },
    "& .MuiInputLabel-root": { color: mode => mode === "dark" ? "#94a3b8" : "#64748b" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#2563eb" },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": { color: mode => mode === "dark" ? "#94a3b8" : "#64748b" },
    "& .MuiFormHelperText-root": { marginLeft: 2 },
  },
  submit: {
    minHeight: 50,
    margin: theme.spacing(2.5, 0, 2),
    borderRadius: 8,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    boxShadow: "0 8px 20px rgba(37,99,235,.24)",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "none",
    transition: "transform .18s ease, box-shadow .18s ease",
    "&:hover": { background: "linear-gradient(135deg, #1d4ed8, #1e40af)", transform: "translateY(-1px)", boxShadow: "0 10px 24px rgba(37,99,235,.3)" },
    "&:active": { transform: "translateY(0)" },
    "&.Mui-disabled": { color: "rgba(255,255,255,.8)", background: "#64748b" },
    "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
  },
  progress: { color: "inherit", marginRight: 10 },
  registerRow: { color: mode => mode === "dark" ? "#94a3b8" : "#64748b", textAlign: "center", fontSize: ".875rem" },
  registerLink: { color: mode => mode === "dark" ? "#93c5fd" : "#1d4ed8", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } },
  languageSelector: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 3,
    [theme.breakpoints.down("xs")]: { top: 14, left: 16 },
  },
  languageDropdown: {
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 11px",
    borderRadius: 8,
    border: mode => mode === "dark" ? "1px solid rgba(255,255,255,.14)" : "1px solid rgba(15,23,42,.12)",
    color: mode => mode === "dark" ? "#e2e8f0" : "#1e293b",
    backgroundColor: mode => mode === "dark" ? "rgba(7,20,38,.75)" : "rgba(255,255,255,.9)",
    boxShadow: "0 6px 18px rgba(15,23,42,.1)",
    font: "inherit",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    "&:focus-visible": { outline: "3px solid rgba(59,130,246,.32)", outlineOffset: 2 },
  },
  chevronOpen: { transform: "rotate(180deg)" },
  languageOptions: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    minWidth: 168,
    padding: 6,
    borderRadius: 8,
    border: mode => mode === "dark" ? "1px solid rgba(255,255,255,.12)" : "1px solid #e2e8f0",
    backgroundColor: mode => mode === "dark" ? "#0f2139" : "#fff",
    boxShadow: "0 16px 36px rgba(15,23,42,.22)",
  },
  languageOption: {
    width: "100%",
    minHeight: 38,
    display: "grid",
    gridTemplateColumns: "20px 1fr 18px",
    alignItems: "center",
    gap: 9,
    padding: "7px 9px",
    border: 0,
    borderRadius: 6,
    color: mode => mode === "dark" ? "#e2e8f0" : "#1e293b",
    background: "transparent",
    font: "inherit",
    fontSize: 14,
    textAlign: "left",
    cursor: "pointer",
    "&:hover, &:focus-visible": { backgroundColor: mode => mode === "dark" ? "rgba(255,255,255,.08)" : "#eff6ff", outline: "none" },
  },
  flagIcon: { width: 20, height: 14, borderRadius: 2, objectFit: "cover" },
  footer: { position: "relative", zIndex: 2, marginTop: 18, color: mode => mode === "dark" ? "#94a3b8" : "#475569", fontSize: ".78rem", textAlign: "center" },
}));

const Login = () => {
  const { colorMode } = useContext(ColorModeContext);
  const { appLogoFavicon, appLogoLight, appLogoDark, appName, mode } = colorMode;
  const classes = useStyles(mode);
  const { getPublicSetting } = useSettings();
  const { handleLogin, loading } = useContext(AuthContext);
  const [user, setUser] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  const [open, setOpen] = useState(false);
  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);
  const [backgroundLight, setBackgroundLight] = useState("");
  const [backgroundDark, setBackgroundDark] = useState("");
  const selectorRef = useRef();

  const companyId = new URLSearchParams(window.location.search).get("companyId");
  const numericCompanyId = companyId ? parseInt(companyId, 10) : null;
  const current = languageOptions.find(opt => i18n.language === opt.value || i18n.language.startsWith(`${opt.value}-`)) || languageOptions[0];
  const isRtl = current.value === "ar";

  useEffect(() => {
    Promise.all([
      getPublicSetting("userCreation", numericCompanyId).then(data => setAllowSignup(data === "enabled")).catch(() => setAllowSignup(false)),
      getPublicSetting("enabledLanguages", numericCompanyId).then(langs => {
        try { setEnabledLanguages(langs ? JSON.parse(langs) : ["pt-BR", "en"]); }
        catch { setEnabledLanguages(["pt-BR", "en"]); }
      }).catch(() => setEnabledLanguages(["pt-BR", "en"])),
      getPublicSetting("appLogoBackgroundLight", numericCompanyId).then(file => setBackgroundLight(file ? `${getBackendUrl()}/public/${file}` : "")).catch(() => setBackgroundLight("")),
      getPublicSetting("appLogoBackgroundDark", numericCompanyId).then(file => setBackgroundDark(file ? `${getBackendUrl()}/public/${file}` : "")).catch(() => setBackgroundDark("")),
    ]);
    // Settings are loaded once for the company encoded in the entry URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const closeOutside = event => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleChangeInput = event => {
    const { name, value } = event.target;
    setUser(previous => ({ ...previous, [name]: value }));
    if (errors[name]) setErrors(previous => ({ ...previous, [name]: "" }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    if (loading) return;
    const nextErrors = {};
    if (!user.email.trim()) nextErrors.email = i18n.t("login.validation.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) nextErrors.email = i18n.t("login.validation.emailInvalid");
    if (!user.password) nextErrors.password = i18n.t("login.validation.passwordRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) handleLogin(user);
  };

  const handleSelect = option => {
    i18n.changeLanguage(option.value);
    localStorage.setItem("language", option.value);
    document.documentElement.dir = option.value === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = option.value;
    setOpen(false);
  };

  const background = mode === "light" ? backgroundLight : backgroundDark;
  const logo = mode === "dark" ? appLogoDark || appLogoLight : appLogoLight || appLogoDark;
  const signupTarget = companyId ? `/signup?companyId=${encodeURIComponent(companyId)}` : "/signup";

  return (
    <>
      <Helmet>
        <html lang={current.value} dir={isRtl ? "rtl" : "ltr"} />
        <title>{appName || "Multi100"}</title>
        <link rel="icon" href={appLogoFavicon || "/default-favicon.ico"} />
      </Helmet>
      <div
        className={clsx(classes.root, "login-page")}
        dir={isRtl ? "rtl" : "ltr"}
        style={background ? { backgroundImage: `url(${background})`, backgroundRepeat: "no-repeat", backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        {background && <div className={classes.customOverlay} />}
        <div ref={selectorRef} className={classes.languageSelector}>
          <button
            type="button"
            className={classes.languageDropdown}
            aria-label={i18n.t("login.accessibility.language")}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
          >
            <img src={current.icon} alt="" className={classes.flagIcon} />
            <span>{current.label}</span>
            <ExpandMoreIcon fontSize="small" className={open ? classes.chevronOpen : undefined} />
          </button>
          {open && (
            <div className={classes.languageOptions} role="listbox" aria-label={i18n.t("login.accessibility.language")}>
              {languageOptions.filter(option => enabledLanguages.includes(option.value)).map(option => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === current.value}
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className={classes.languageOption}
                >
                  <img src={option.icon} alt="" className={classes.flagIcon} />
                  <span>{option.label}</span>
                  {option.value === current.value ? <CheckIcon fontSize="small" /> : <span />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Container component="main" maxWidth="xs" className={classes.containerLogin}>
          <CssBaseline />
          <div className={classes.paper}>
            <IconButton className={classes.themeButton} onClick={colorMode.toggleColorMode} aria-label={i18n.t("login.accessibility.toggleTheme")}>
              {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
            <div className={classes.brand}>
              <img className={classes.logoImg} src={logo || defaultLogoLight} alt={appName || "Multi100"} />
            </div>
            <h1 className={classes.welcome}>{i18n.t("login.form.title")}</h1>
            <p className={classes.subtitle}>{i18n.t("login.form.subtitle")}</p>
            <form className={classes.form} noValidate onSubmit={handleSubmit}>
              <TextField
                variant="outlined" margin="normal" required fullWidth id="email" type="email"
                label={i18n.t("login.form.email")} name="email" value={user.email}
                onChange={handleChangeInput} autoComplete="email" autoFocus className={classes.textField}
                error={Boolean(errors.email)} helperText={errors.email || " "}
                inputProps={{ "aria-describedby": errors.email ? "email-helper-text" : undefined }}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon /></InputAdornment> }}
              />
              <TextField
                variant="outlined" margin="normal" required fullWidth name="password"
                label={i18n.t("login.form.password")} type={showPassword ? "text" : "password"}
                id="password" value={user.password} onChange={handleChangeInput}
                autoComplete="current-password" className={classes.textField}
                error={Boolean(errors.password)} helperText={errors.password || " "}
                inputProps={{ "aria-describedby": errors.password ? "password-helper-text" : undefined }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockOutlinedIcon /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={i18n.t(showPassword ? "login.accessibility.hidePassword" : "login.accessibility.showPassword")}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(value => !value)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button type="submit" fullWidth variant="contained" className={classes.submit} disabled={loading} aria-busy={loading}>
                {loading && <CircularProgress size={18} className={classes.progress} />}
                {loading ? i18n.t("login.buttons.loading") : i18n.t("login.buttons.submit")}
              </Button>
              {allowSignup && (
                <Grid container justify="center" className={classes.registerRow}>
                  <Grid item>
                    <Link component={RouterLink} to={signupTarget} className={classes.registerLink}>
                      {i18n.t("login.buttons.register")}
                    </Link>
                  </Grid>
                </Grid>
              )}
            </form>
          </div>
        </Container>
        <div className={classes.footer}>© {new Date().getFullYear()} {appName || "Multi100"}</div>
      </div>
    </>
  );
};

export default Login;
