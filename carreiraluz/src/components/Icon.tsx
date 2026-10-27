// Ícones de traço (desenhos no estilo Lucide), sem dependência externa.

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  bank: 'M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z',
  cloud: 'M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z',
  cart: 'M3 3h2l2.4 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  signal: 'M5 20v-4M9.5 20v-8M14 20v-12M18.5 20V4',
  heart: 'M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z',
  factory: 'M2 20V9l6 4V9l6 4V4h4l2 16zM2 20h20',
  school: 'M22 10 12 5 2 10l10 5zM6 12v5c3 2 9 2 12 0v-5',
  package: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  briefcase: 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M3 13h18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  'size-s': 'M9 21V13h6v8M7 21h10',
  'size-m': 'M7 21V10h10v11M10 13h1M13 13h1M10 16h1M13 16h1M5 21h14',
  'size-l': 'M5 21V7h9v14M14 11h5v10M8 10h1M11 10h1M8 13h1M11 13h1M8 16h1M11 16h1M3 21h18',
  'size-xl': 'M4 21V3h8v18M12 8h8v13M7 6h2M7 9h2M7 12h2M7 15h2M15 11h2M15 14h2M15 17h2M2 21h20',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  wallet: 'M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6M16 14h.01',
  mountain: 'M3 20 9.5 8l4 7 2.5-4 5 9zM9.5 8l1.5 3',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  check: 'M20 6 9 17l-5-5',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  plus: 'M12 5v14M5 12h14',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  message: 'M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12z',
  shield: 'M12 21s8-4 8-10V5l-8-3-8 3v6c0 6 8 10 8 10z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 18l-6-6 6-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  trend: 'M22 7 13.5 15.5l-5-5L2 17M16 7h6v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={P[name] ?? P.more} />
    </svg>
  );
}
