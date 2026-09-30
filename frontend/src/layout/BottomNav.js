/**
 * Fase 2 — navegación inferior móvil (< 600px).
 * Solo rutas reales existentes. "Más" abre el menú completo (MainListItems),
 * que ya aplica sus propios permisos: aquí no se decide ningún acceso nuevo.
 */
import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Paper from "@mui/material/Paper";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import List from "@material-ui/core/List";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import WhatsApp from "@mui/icons-material/WhatsApp";
import ContactsOutlined from "@mui/icons-material/ContactsOutlined";
import FlashOnOutlined from "@mui/icons-material/FlashOnOutlined";
import MenuRounded from "@mui/icons-material/MenuRounded";
import { AuthContext } from "../context/Auth/AuthContext";
import { i18n } from "../translate/i18n";
import tokensBase from "../theme/tokens";
import MainListItems from "./MainListItems";
import { BottomSheet } from "../components/ui";

// En una conversación abierta la barra taparía el campo de mensaje.
export const ocultarBottomNav = (pathname) => /^\/tickets\/[^/]+/.test(pathname);

const BottomNav = () => {
  const theme = useTheme();
  const t = theme.palette.tokens;
  const movil = useMediaQuery("(max-width:599.95px)");
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const location = useLocation();
  const [masAbierto, setMasAbierto] = useState(false);

  useEffect(() => setMasAbierto(false), [location.pathname]);

  if (!movil || ocultarBottomNav(location.pathname)) return null;

  const items = [
    { value: "/", label: i18n.t("mainDrawer.listItems.dashboard"), icon: <HomeOutlined /> },
    { value: "/tickets", label: i18n.t("mainDrawer.listItems.tickets"), icon: <WhatsApp /> },
    user?.showContacts === "enabled"
      ? { value: "/contacts", label: i18n.t("mainDrawer.listItems.contacts"), icon: <ContactsOutlined /> }
      : null,
    { value: "/quick-messages", label: i18n.t("mainDrawer.listItems.quickMessages"), icon: <FlashOnOutlined /> },
  ].filter(Boolean);

  const p = location.pathname;
  const actual = masAbierto
    ? "mas"
    : items.find((i) => (i.value === "/" ? p === "/" : p.startsWith(i.value)))?.value || "mas";

  return (
    <>
      <Paper
        elevation={0}
        component="nav"
        aria-label="Navegación principal"
        sx={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          zIndex: tokensBase.zIndex.bottomNav,
          borderTop: `1px solid ${t.sidebar.border}`,
          backgroundColor: t.sidebar.background,
          pb: "env(safe-area-inset-bottom)",
        }}
      >
        <BottomNavigation
          showLabels
          value={actual}
          onChange={(_, v) => (v === "mas" ? setMasAbierto(true) : history.push(v))}
          sx={{
            height: tokensBase.layout.bottomNav,
            backgroundColor: "transparent",
            "& .MuiBottomNavigationAction-root": {
              minWidth: 0, minHeight: tokensBase.layout.touchTarget, px: 0.5,
              color: t.sidebar.textMuted,
            },
            "& .Mui-selected": { color: t.sidebar.accentText },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.6875rem !important", fontWeight: 600,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            },
          }}
        >
          {items.map((i) => (
            <BottomNavigationAction key={i.value} value={i.value} label={i.label} icon={i.icon} />
          ))}
          <BottomNavigationAction value="mas" label={i18n.t("bottomNav.more")} icon={<MenuRounded />} />
        </BottomNavigation>
      </Paper>

      <BottomSheet open={masAbierto} onClose={() => setMasAbierto(false)} title={i18n.t("bottomNav.menu")} fullHeight>
        <List>
          <MainListItems collapsed={false} drawerClose={() => setMasAbierto(false)} />
        </List>
      </BottomSheet>
    </>
  );
};

export default BottomNav;
