/** Tallyfield design tokens. The single source of truth for colour and type; mirrored as CSS variables in globals.css. */
export const theme = {
  color: {
    bg: '#050505',
    inkCream: '#F6E7D4',
    gold: '#B0925E',
    goldLight: '#C8A86B',
    grey1: '#CFC3B0',
    grey2: '#A39A8A',
    grey3: '#7D766A',
    panel: '#10221E',
    panelHi: '#142B25',
    ruleDark: '#2C3D38',
    stroke: '#33463F',
    onGold: '#061412',
    warn: '#D9A35B',
    ornament: '#526044',
  },
  font: {
    display: "Anton, 'Bebas Neue', Impact, sans-serif",
    sans: "Inter, Arimo, 'Helvetica Neue', Arial, sans-serif",
  },
  layout: { maxWidth: 1296, gutter: 24 },
} as const

export type Theme = typeof theme
