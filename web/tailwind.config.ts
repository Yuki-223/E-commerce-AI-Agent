import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const v = (name: string) => `var(--${name})`

// Entry keyframes. Each exit runs to its entry's starting frame, played forward
// with the same tokens: ease-out starts moving at once, so a closing overlay
// answers the click immediately (a reversed ease-out would sit still first).
const fadeIn = { from: { opacity: '0' } }
const popIn = { from: { opacity: '0', transform: 'translateY(4px) scale(0.97)' } }
const popUp = { from: { opacity: '0', transform: 'translateY(-4px) scale(0.97)' } }
const dialogIn = { from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' } }
const drawerIn = { from: { transform: 'translateX(-100%)' } }
const panelIn = { from: { transform: 'translateX(100%)' } }
// Collapse: a grid row grows from 0fr, so whatever is below slides instead of jumping.
const expandIn = { from: { gridTemplateRows: '0fr', opacity: '0' } }
const exit = (entry: { from: Record<string, string> }) => ({ to: entry.from })
/** Exit: 120ms, held on the last frame until usePresence unmounts it. */
const out = (name: string, dur = 'dur-snap', ease = 'ease-out') => `${name} var(--${dur}) var(--${ease}) forwards`

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
        'input-focus': v('shadow-input-focus'),
      },
      transitionDuration: {
        fast: v('dur-fast'),
        snap: v('dur-snap'),
        base: v('dur-base'),
        sheet: v('dur-sheet'),
        slow: v('dur-slow'),
      },
      transitionTimingFunction: {
        out: v('ease-out'),
        snap: v('ease-snap'),
        overshoot: v('ease-overshoot'),
      },
      keyframes: {
        'fade-in': fadeIn,
        'pop-in': popIn,
        'pop-up': popUp,
        'dialog-in': dialogIn,
        'drawer-in': drawerIn,
        'fade-out': exit(fadeIn),
        'pop-out': exit(popIn),
        'pop-up-out': exit(popUp),
        'dialog-out': exit(dialogIn),
        'drawer-out': exit(drawerIn),
        'panel-in': panelIn,
        'panel-out': exit(panelIn),
        'expand-in': expandIn,
        'collapse-out': exit(expandIn),
        reveal: { from: { opacity: '0', filter: 'blur(6px)' } },
        'bubble-in': { from: { opacity: '0', transform: 'translateY(6px) scale(0.92)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' } },
        // Thinking dots: each rises, holds, then fades before the next wave.
        'quiet-dot': {
          '0%, 8%': { opacity: '0', transform: 'translateY(2px)' },
          '22%': { opacity: '1', transform: 'translateY(-2.5px)' },
          '36%, 70%': { opacity: '1', transform: 'translateY(0)' },
          '90%, 100%': { opacity: '0', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-base) var(--ease-out)',
        // Menus opening upward (composer +, account) rise; dropdowns drop.
        'pop-in': 'pop-in var(--dur-base) var(--ease-out)',
        'pop-up': 'pop-up var(--dur-base) var(--ease-out)',
        'dialog-in': 'dialog-in var(--dur-base) var(--ease-out)',
        'drawer-in': 'drawer-in var(--dur-sheet) var(--ease-snap)',
        'toast-in': 'pop-in var(--dur-sheet) var(--ease-overshoot)',
        // Exits (usePresence): 120ms; the phone drawer and its scrim take 200ms.
        'fade-out': out('fade-out'),
        'pop-out': out('pop-out'),
        'pop-up-out': out('pop-up-out'),
        'dialog-out': out('dialog-out'),
        'drawer-out': out('drawer-out', 'dur-base', 'ease-snap'),
        'drawer-scrim-out': out('fade-out', 'dur-base', 'ease-snap'),
        // Desktop product panel: slides over main, 300ms both ways.
        'panel-in': 'panel-in var(--dur-sheet) var(--ease-snap)',
        'panel-out': out('panel-out', 'dur-sheet', 'ease-snap'),
        // Rows, banners and list items open and close their height in 200ms.
        'expand-in': 'expand-in var(--dur-base) var(--ease-out)',
        'collapse-out': out('collapse-out', 'dur-base'),
        // Streamed text: each new piece sharpens out of a blur.
        reveal: 'reveal var(--dur-base) cubic-bezier(.215, .61, .355, 1)',
        'bubble-in': 'bubble-in var(--dur-slow) var(--ease-overshoot)',
        'fade-up': 'fade-up var(--dur-slow) var(--ease-out)',
        'quiet-dot': 'quiet-dot 1.9s cubic-bezier(.4, 0, .2, 1) infinite',
      },
    },
  },
  plugins: [
    // usePresence sets data-state="closed" while an overlay plays its exit.
    // closing: styles that element; closing-in: anything inside a closing overlay.
    plugin(({ addVariant }) => {
      addVariant('closing', '&[data-state=closed]')
      addVariant('closing-in', '[data-state=closed] &')
    }),
  ],
} satisfies Config
