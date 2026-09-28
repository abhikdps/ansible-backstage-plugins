/**
 * Static design token constants for `@ansible/backstage-rhaap-react`.
 *
 * These are **static defaults** and do NOT adapt to the active Backstage theme.
 * For theme-aware styling, use the CSS custom properties injected by
 * `ExtensionRenderer` (`--rhaap-*` tokens derived from `useTheme()` at render time).
 *
 * Use these tokens for fixed sizing values (icon sizes, border radii) where
 * dynamic theme adaptation is not required.
 */
export const rhaapTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: 8,
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSizeBody: '0.875rem',
    fontSizeHeading: '1.25rem',
  },
  colors: {
    primary: '#1976d2',
    error: '#d32f2f',
    warning: '#f57c00',
    success: '#388e3c',
  },
} as const;

export type RhaapTokens = typeof rhaapTokens;
