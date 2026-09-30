/**
 * Fase 2 — publica theme.palette.tokens como variables CSS --ss-*.
 * No define colores propios: todo sale del tema (azul existente + Whitelabel).
 */
const STYLE_ID = "ss-design-tokens";

export function buildCssVariables(t) {
  if (!t) return "";
  const v = {
    "--ss-primary": t.brand.primary,
    "--ss-primary-hover": t.brand.primaryHover,
    "--ss-on-primary": t.brand.onPrimary,
    "--ss-primary-text": t.brand.onSurface,
    "--ss-background": t.surface.background,
    "--ss-surface": t.surface.surface,
    "--ss-surface-2": t.surface.surfaceSecondary,
    "--ss-surface-elevated": t.surface.elevated,
    "--ss-text": t.text.primary,
    "--ss-text-secondary": t.text.secondary,
    "--ss-text-muted": t.text.muted,
    "--ss-border": t.border.border,
    "--ss-border-strong": t.border.strong,
    "--ss-success": t.semantic.success.fill,
    "--ss-warning": t.semantic.warning.fill,
    "--ss-danger": t.semantic.error.fill,
    "--ss-info": t.semantic.info.fill,
    "--ss-radius-sm": `${t.radius.sm}px`,
    "--ss-radius-md": `${t.radius.md}px`,
    "--ss-radius-lg": `${t.radius.lg}px`,
    "--ss-shadow-sm": t.shadow.sm,
    "--ss-shadow-md": t.shadow.md,
    "--ss-shadow-lg": t.shadow.lg,
    "--ss-bottom-nav": `${t.layout?.bottomNav || 60}px`,
    "--ss-touch": `${t.layout?.touchTarget || 44}px`,
  };
  return `:root{${Object.entries(v)
    .filter(([, val]) => val != null)
    .map(([k, val]) => `${k}:${val};`)
    .join("")}}`;
}

export function applyCssVariables(t) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCssVariables(t);
}
