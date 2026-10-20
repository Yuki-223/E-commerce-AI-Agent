/** Stroke icons copied from the design artboards (inline SVG, currentColor). */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = (vb: string, size: number | undefined, w: number, h: number, props: P) => {
  const { size: _s, ...rest } = props
  void _s
  const scale = size ? size / Math.max(w, h) : 1
  return {
    viewBox: vb,
    width: Math.round(w * scale),
    height: Math.round(h * scale),
    'aria-hidden': true,
    focusable: false,
    ...rest,
  } as SVGProps<SVGSVGElement>
}

const S = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const IconCompose = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 15, 15, p)} {...S} strokeWidth={2.2}>
    <path d="M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M17.5 3.5l3 3L12 15l-4 1 1-4z" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 13, 13, p)} {...S} strokeWidth={2.4}>
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M16 16l5 5" />
  </svg>
)

export const IconGear = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 16, 16, p)} {...S} strokeWidth={2}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
)

export const IconShare = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} {...S} strokeWidth={2}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
  </svg>
)

export const IconCart = (p: P) => (
  <svg {...base('0 0 26 24', p.size, 18, 17, p)} {...S} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="M2 3h3l2.6 12.5h12.6L23 6.5H6" />
    <circle cx="9.5" cy="20" r="1.6" />
    <circle cx="18" cy="20" r="1.6" />
  </svg>
)

export const IconCartAdd = (p: P) => (
  <svg {...base('0 0 28 24', p.size, 19, 16, p)} {...S} strokeWidth={2.2}>
    <path d="M1.5 3h3l2.6 12.5h11.6L21 8" />
    <circle cx="9" cy="20" r="1.6" />
    <circle cx="17" cy="20" r="1.6" />
    <path d="M20 1.5v8M16 5.5h8" />
  </svg>
)

export const IconCompare = (p: P) => (
  <svg {...base('0 0 24 20', p.size, 15, 13, p)} {...S} strokeWidth={2.2}>
    <rect x="2" y="2" width="20" height="16" rx="3" />
    <path d="M12 2v16" />
  </svg>
)

export const IconPlus = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} {...S} strokeWidth={p.strokeWidth ?? 3}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconImage = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
)

export const IconCamera = (p: P) => (
  <svg {...base('0 0 24 20', p.size, 18, 16, p)} {...S} strokeWidth={2.2}>
    <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h2.2L8.5 1.5h7L17.3 4h2.2A2.5 2.5 0 0 1 22 6.5v9A2.5 2.5 0 0 1 19.5 18h-15A2.5 2.5 0 0 1 2 15.5z" />
    <circle cx="12" cy="10.5" r="3.6" />
  </svg>
)

export const IconMic = (p: P) => (
  <svg {...base('0 0 16 22', p.size, 15, 18, p)} fill="currentColor">
    <rect x="4" y="1" width="8" height="13" rx="4" />
    <path d="M1.5 10a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M8 16.5V20M5 20.5h6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)

export const IconSend = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 17, 17, p)} {...S} strokeWidth={3}>
    <path d="M12 20V5M5 11l7-7 7 7" />
  </svg>
)

export const IconStop = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="3" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base('0 0 12 12', p.size, 12, 12, p)} {...S} strokeWidth={p.strokeWidth ?? 1.8}>
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
)

export const IconBulb = (p: P) => (
  <svg {...base('0 0 20 24', p.size, 12, 14, p)} {...S} strokeWidth={2.2}>
    <path d="M7 18h6M8 21.5h4" />
    <path d="M10 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 10 2z" />
  </svg>
)

export const IconSliders = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />
  </svg>
)

export const IconChevronRight = (p: P) => (
  <svg {...base('0 0 10 16', p.size, 7, 12, p)} {...S} strokeWidth={2.6}>
    <path d="M2 2l6 6-6 6" />
  </svg>
)

export const IconChevronLeft = (p: P) => (
  <svg {...base('0 0 10 16', p.size, 7, 12, p)} {...S} strokeWidth={2.4}>
    <path d="M8 2L2 8l6 6" />
  </svg>
)

export const IconChevronDown = (p: P) => (
  <svg {...base('0 0 16 10', p.size, 9, 6, p)} {...S} strokeWidth={2.6}>
    <path d="M2 2l6 6 6-6" />
  </svg>
)

export const IconChevronUp = (p: P) => (
  <svg {...base('0 0 16 10', p.size, 9, 6, p)} {...S} strokeWidth={2.6}>
    <path d="M2 8l6-6 6 6" />
  </svg>
)

export const IconHistory = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </svg>
)

export const IconHelp = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" />
    <circle cx="12" cy="17.6" r="0.6" fill="currentColor" />
  </svg>
)

export const IconSun = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 16, 16, p)} {...S} strokeWidth={1.9}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
)

export const IconMoon = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 16, 16, p)} {...S} strokeWidth={1.9}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
)

export const IconMonitor = (p: P) => (
  <svg {...base('0 0 26 22', p.size, 17, 15, p)} {...S} strokeWidth={1.9}>
    <rect x="4" y="2.5" width="18" height="12" rx="1.8" />
    <path d="M1.5 18.5h23" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base('0 0 22 24', p.size, 16, 17, p)} {...S} strokeWidth={2}>
    <path d="M2 5h18M8 5V2.5h6V5M4.5 5l1 16.5h11l1-16.5M9 10v7M13 10v7" />
  </svg>
)

export const IconPencil = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} {...S} strokeWidth={2.4}>
    <path d="M16 3l5 5L8 21H3v-5z" />
  </svg>
)

export const IconCheckCircle = (p: P & { tone?: string }) => {
  const { tone, ...rest } = p
  return (
    <svg {...base('0 0 24 24', rest.size, 16, 16, rest)}>
      <circle cx="12" cy="12" r="11" fill={tone ?? 'currentColor'} />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const IconPlusCircle = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)

export const IconCrown = (p: P) => (
  <svg {...base('0 0 20 16', p.size, 11, 9, p)} fill="currentColor">
    <path d="M1 4l5 4 4-7 4 7 5-4-2 11H3z" />
  </svg>
)

export const IconArrowDown = (p: P) => (
  <svg {...base('0 0 16 16', p.size, 13, 13, p)} {...S} strokeWidth={2.2}>
    <path d="M8 2v12M3 9l5 5 5-5" />
  </svg>
)

export const IconAlert = (p: P) => (
  <svg {...base('0 0 24 22', p.size, 16, 15, p)}>
    <path d="M12 1.5L23 20.5H1z" fill="currentColor" />
    <path d="M12 8v6" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.3" fill="#FFFFFF" />
  </svg>
)

export const IconRetry = (p: P) => (
  <svg {...base('0 0 16 16', p.size, 15, 15, p)} {...S} strokeWidth={2.2}>
    <path d="M13 8a5 5 0 1 1-1.5-3.5" />
    <path d="M13 2.5v3h-3" />
  </svg>
)

export const IconUndo = (p: P) => (
  <svg {...base('0 0 16 16', p.size, 15, 15, p)} {...S} strokeWidth={2}>
    <path d="M3 8a5 5 0 1 0 1.5-3.5" />
    <path d="M3 2.5v3h3" />
  </svg>
)

export const IconWifiOff = (p: P) => (
  <svg {...base('0 0 24 22', p.size, 20, 18, p)} {...S} strokeWidth={2.2}>
    <path d="M2 7.5a14 14 0 0 1 16.5-2.3" />
    <path d="M5.5 11a9 9 0 0 1 8.5-2.3" />
    <path d="M9 14.5a4 4 0 0 1 3.5-1" />
    <circle cx="11" cy="18.5" r="1.2" fill="currentColor" />
    <path d="M20 9v6" />
    <circle cx="20" cy="18.5" r="0.6" fill="currentColor" />
  </svg>
)

/** Two-line "open sidebar" mark (long over short), as in claude.ai / ChatGPT / Grok on phones. */
export const IconMenu = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 22, 22, p)} {...S} strokeWidth={1.9}>
    <path d="M3.5 8.5h17M3.5 15.5h10" />
  </svg>
)

export const IconSwipe = (p: P) => (
  <svg {...base('0 0 24 14', p.size, 18, 11, p)} {...S} strokeWidth={2}>
    <path d="M6 2L2 7l4 5M18 2l4 5-4 5M2 7h20" />
  </svg>
)

export const IconAddSquare = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 20, 20, p)} {...S} strokeWidth={2}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)

export const IconMore = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 16, 16, p)} fill="currentColor">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

export const IconUsers = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
  </svg>
)

export const IconDatabase = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={2}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
)

export const IconSidebar = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={1.9}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9.5 4v16" />
  </svg>
)

export const IconChevronUpDown = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} {...S} strokeWidth={2.2}>
    <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
  </svg>
)

export const IconBox = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 18, 18, p)} {...S} strokeWidth={1.9}>
    <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base('0 0 24 24', p.size, 14, 14, p)} {...S} strokeWidth={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** CartPilot mark: a shopping bag with a four-point glint on its face. */
export const IconCartPilot = (p: P) => (
  <svg {...base('0 0 32 32', p.size, 32, 32, p)} {...S} strokeWidth={p.strokeWidth ?? 1.8}>
    <path d="M6.5 10.5h19l-1.4 15.2a2 2 0 0 1-2 1.8H9.9a2 2 0 0 1-2-1.8z" />
    <path d="M11.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5" />
    <path d="M16 15.5c.35 2.4 1.1 3.15 3.5 3.5-2.4.35-3.15 1.1-3.5 3.5-.35-2.4-1.1-3.15-3.5-3.5 2.4-.35 3.15-1.1 3.5-3.5z" />
  </svg>
)
