import type { Config } from 'tailwindcss'

/**
 * motoflip design system — §31.
 * Dark is the primary (and currently only) theme. Colours are declared as CSS
 * custom properties in globals.css so a light theme can be layered later
 * without touching component code.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        elevated: 'hsl(var(--elevated) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',

        fg: {
          DEFAULT: 'hsl(var(--fg) / <alpha-value>)',
          muted: 'hsl(var(--fg-muted) / <alpha-value>)',
          subtle: 'hsl(var(--fg-subtle) / <alpha-value>)',
        },

        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          fg: 'hsl(var(--accent-fg) / <alpha-value>)',
          muted: 'hsl(var(--accent-muted) / <alpha-value>)',
        },

        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          muted: 'hsl(var(--success-muted) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          muted: 'hsl(var(--warning-muted) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          muted: 'hsl(var(--danger-muted) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          muted: 'hsl(var(--info-muted) / <alpha-value>)',
        },
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      borderRadius: {
        lg: '14px',
        md: '10px',
        sm: '7px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Tabular financial figures need their own scale — §44
        'metric-sm': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        'metric': ['20px', { lineHeight: '26px', fontWeight: '650' }],
        'metric-lg': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'metric-xl': ['34px', { lineHeight: '40px', fontWeight: '700' }],
      },
      spacing: {
        // §32 — minimum touch target
        tap: '44px',
        'safe-b': 'env(safe-area-inset-bottom)',
        nav: '64px',
      },
      maxWidth: {
        app: '520px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 180ms ease-out',
        'accordion-up': 'accordion-up 180ms ease-out',
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
