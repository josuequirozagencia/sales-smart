/**
 * Fase 2 — primitivos visuales sobre MUI v5 (librería destino ya instalada).
 * Solo presentación; leen theme.palette.tokens (azul existente + Whitelabel).
 * No se migra ninguna pantalla todavía: eso es Fase 3.
 */
import React from "react";
import { useTheme, alpha } from "@mui/material/styles";
import MuiButton from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Drawer from "@mui/material/Drawer";
import tokensBase from "../../theme/tokens";

export function useTokens() {
  const theme = useTheme();
  return theme?.palette?.tokens || null;
}

export const useIsDark = () => useTheme().palette.mode === "dark";

// Botón: variantes primary | secondary | ghost | danger. Alto mínimo táctil.
export function Button({ tone = "primary", sx, ...props }) {
  const t = useTokens();
  const map = {
    primary: { variant: "contained", color: "primary" },
    secondary: { variant: "outlined", color: "primary" },
    ghost: { variant: "text", color: "primary" },
    danger: { variant: "contained", color: "error" },
  };
  return (
    <MuiButton
      disableElevation
      {...map[tone]}
      sx={{
        minHeight: tokensBase.layout.touchTarget - 8,
        borderRadius: `${t?.radius.md ?? 8}px`,
        textTransform: "none",
        fontWeight: 600,
        "@media (pointer: coarse)": { minHeight: tokensBase.layout.touchTarget },
        ...sx,
      }}
      {...props}
    />
  );
}

export function Card({ padding = "lg", sx, children, ...props }) {
  const t = useTokens();
  return (
    <Paper
      elevation={0}
      sx={{
        p: `${t?.space[padding] ?? 16}px`,
        borderRadius: `${t?.radius.lg ?? 12}px`,
        border: `1px solid ${t?.border.border}`,
        backgroundColor: t?.surface.surface,
        boxShadow: t?.shadow.sm,
        minWidth: 0,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

export function StatCard({ label, value, icon, hint }) {
  const t = useTokens();
  return (
    <Card>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {icon && (
          <Box
            sx={{
              width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center",
              borderRadius: `${t?.radius.md}px`,
              color: t?.brand.onSurface,
              backgroundColor: alpha(t?.brand.primary || "#157aad", 0.1),
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: t?.typography.label.size, color: t?.text.muted }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: t?.typography.h2.size, fontWeight: 700, color: t?.text.primary }}>
            {value}
          </Typography>
          {hint && (
            <Typography sx={{ fontSize: t?.typography.caption.size, color: t?.text.secondary }}>
              {hint}
            </Typography>
          )}
        </Box>
      </Box>
    </Card>
  );
}

// Cabecera de página: apila en móvil, en línea desde 600px.
export function PageHeader({ title, subtitle, actions }) {
  const t = useTokens();
  return (
    <Box
      sx={{
        display: "flex", flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between",
        gap: 1.5, mb: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" sx={{ fontSize: { xs: t?.typography.h3.size, sm: t?.typography.h2.size }, fontWeight: 700, color: t?.text.primary }}>
          {title}
        </Typography>
        {subtitle && <Typography sx={{ fontSize: t?.typography.bodySm.size, color: t?.text.secondary }}>{subtitle}</Typography>}
      </Box>
      {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
    </Box>
  );
}

const TONES = { success: "success", warning: "warning", danger: "error", info: "info" };
export function StatusBadge({ tone = "info", children }) {
  const t = useTokens();
  const s = t?.semantic[TONES[tone]] || tokensBase.semantic.info;
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", gap: 0.75, px: 1, py: 0.25,
      borderRadius: `${tokensBase.radius.full}px`, fontSize: tokensBase.typography.label.size, fontWeight: 600,
      color: s.text, backgroundColor: s.soft,
    }}>
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s.fill }} />
      {children}
    </Box>
  );
}

export function EmptyState({ icon, title, description, action }) {
  const t = useTokens();
  return (
    <Box sx={{ textAlign: "center", py: 6, px: 2, color: t?.text.secondary }}>
      {icon && <Box sx={{ mb: 1.5, color: t?.text.muted, "& svg": { fontSize: 40 } }}>{icon}</Box>}
      <Typography sx={{ fontWeight: 600, color: t?.text.primary }}>{title}</Typography>
      {description && <Typography sx={{ fontSize: t?.typography.bodySm.size, mt: 0.5 }}>{description}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export function LoadingRows({ rows = 3, height = 48 }) {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={height} sx={{ mb: 1, borderRadius: 1 }} />
      ))}
    </Box>
  );
}

// Bottom sheet móvil: Drawer inferior con asa y área segura.
export function BottomSheet({ open, onClose, title, children, fullHeight = false }) {
  const t = useTokens();
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: fullHeight ? "92vh" : "auto", maxHeight: "92vh",
          borderTopLeftRadius: `${(t?.radius.lg ?? 12) + 4}px`,
          borderTopRightRadius: `${(t?.radius.lg ?? 12) + 4}px`,
          backgroundColor: t?.sidebar.background, backgroundImage: "none",
          pb: "env(safe-area-inset-bottom)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t?.border.strong }} />
      </Box>
      {title && (
        <Typography sx={{ px: 2, pt: 1.5, pb: 1, fontWeight: 700, color: t?.text.primary }}>{title}</Typography>
      )}
      <Box sx={{ overflowY: "auto", flex: 1 }}>{children}</Box>
    </Drawer>
  );
}

/* ------------------------------------------------------------------------
 * Fase 3 — patrones compartidos (Dashboard primero; los reutilizan los
 * bloques siguientes). Solo presentación.
 * ---------------------------------------------------------------------- */

// Color de acento por tono semántico; "brand" sigue al color de empresa.
export function useToneColor(tone = "brand") {
  const t = useTokens();
  if (tone === "brand" || !t?.semantic?.[TONES[tone] || tone]) {
    return t?.brand?.primary || tokensBase.brand?.primary || "#157aad";
  }
  return t.semantic[TONES[tone] || tone].fill;
}

// KPI: etiqueta, valor, contexto opcional e icono con acento por tono.
export function KpiCard({ label, value, icon, hint, tone = "brand", loading = false }) {
  const t = useTokens();
  const color = useToneColor(tone);
  return (
    <Card padding="lg" sx={{
      height: "100%",
      transition: `border-color ${tokensBase.motion?.fast ?? "150ms"}, box-shadow ${tokensBase.motion?.fast ?? "150ms"}`,
      "&:hover": { borderColor: alpha(color, 0.45), boxShadow: t?.shadow.md },
    }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: t?.typography.label.size, fontWeight: 600, color: t?.text.muted, lineHeight: 1.3 }}>
            {label}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={72} sx={{ fontSize: 28 }} />
          ) : (
            <Typography sx={{ mt: 0.75, fontSize: { xs: 22, sm: 26 }, fontWeight: 700, lineHeight: 1.1, color: t?.text.primary, fontVariantNumeric: "tabular-nums", wordBreak: "break-word" }}>
              {value}
            </Typography>
          )}
          {hint && (
            <Typography sx={{ mt: 0.5, fontSize: t?.typography.caption.size, color: t?.text.secondary }}>{hint}</Typography>
          )}
        </Box>
        {icon && (
          <Box sx={{
            width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center",
            borderRadius: `${t?.radius.md ?? 8}px`, color, backgroundColor: alpha(color, 0.12),
            "& svg": { fontSize: 22 },
          }}>{icon}</Box>
        )}
      </Box>
    </Card>
  );
}

// Encabezado de sección dentro de una página.
export function SectionHeader({ title, subtitle, actions, sx }) {
  const t = useTokens();
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, ...sx }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: t?.text.primary }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: t?.typography.caption.size, color: t?.text.secondary }}>{subtitle}</Typography>}
      </Box>
      {actions}
    </Box>
  );
}

// Rejilla responsive: 1 columna en móvil y `cols` en escritorio.
export function ResponsiveGrid({ min = 220, gap = 2, children, sx }) {
  return (
    <Box sx={{
      display: "grid", gap,
      gridTemplateColumns: { xs: "1fr", sm: `repeat(auto-fill, minmax(${min}px, 1fr))` },
      ...sx,
    }}>{children}</Box>
  );
}

// Barra de progreso con tono semántico (NPS, índices).
export function MeterRow({ label, value = 0, tone = "brand", suffix = "%" }) {
  const t = useTokens();
  const color = useToneColor(tone);
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75, gap: 1 }}>
        <Typography sx={{ fontSize: t?.typography.bodySm.size, color: t?.text.secondary }}>{label}</Typography>
        <Typography sx={{ fontSize: t?.typography.bodySm.size, fontWeight: 700, color: t?.text.primary, fontVariantNumeric: "tabular-nums" }}>
          {value}{suffix}
        </Typography>
      </Box>
      <Box sx={{ height: 8, borderRadius: 4, backgroundColor: t?.surface.surfaceSecondary || alpha(color, 0.12), overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", borderRadius: 4, backgroundColor: color, transition: "width 250ms cubic-bezier(0.2,0,0,1)" }} />
      </Box>
    </Box>
  );
}
