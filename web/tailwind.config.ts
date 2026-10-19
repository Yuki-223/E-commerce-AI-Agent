import type { Config } from 'tailwindcss'

const v = (name: string) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('primary'), text: v('primary-text'), hover: v('primary-hover'), soft: v('primary-soft'), tint: v('primary-tint') },
        'on-primary': v('on-primary'),
        secondary: v('secondary'),
        'soft-blue': v('soft-blue'),
        'soft-purple': v('soft-purple'),
        bg: v('background'),
        surface: v('surface'),
        sidebar: { DEFAULT: v('sidebar'), hover: v('sidebar-hover'), active: v('sidebar-active') },
        field: v('field'),
        chip: v('chip'),
        ink: { DEFAULT: v('text-primary'), secondary: v('text-secondary'), muted: v('text-muted'), subtle: v('text-subtle') },
        error: { DEFAULT: v('error'), text: v('error-text') },
        success: { DEFAULT: v('success'), text: v('success-text') },
        line: { DEFAULT: v('line'), strong: v('line-strong'), faint: v('line-faint') },
        disabled: v('disabled'),
        avatar: v('avatar'),
        'star-empty': v('star-empty'),
        overlay: v('overlay'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        logo: ['var(--font-logo)'],
        serif: ['var(--font-serif)'],
      },
      boxShadow: {
        card: v('shadow-card'),
        pop: v('shadow-pop'),
        input: v('shadow-input'),
      },
    },
  },
  plugins: [],
} satisfies Config
