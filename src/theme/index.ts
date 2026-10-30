import { Platform } from 'react-native';

export const colors = {
  felt: '#0f5c3d',
  feltDark: '#0a3d2a',
  feltLight: '#1a7a52',
  feltMid: '#127048',
  cream: '#f3efe4',
  ink: '#14181c',
  muted: '#8ea3a0',
  gold: '#e8c547',
  goldHi: '#f6e7a2',
  goldDark: '#b8922a',
  danger: '#e05b4c',
  good: '#2ecc71',
  card: '#fffdf8',
  cardBack: '#1a4f9c',
  cardBackInk: '#0d2d66',
  redSuit: '#C41E3A',
  blackSuit: '#141414',
  overlay: 'rgba(8, 14, 18, 0.82)',
  seatYou: '#e8c547',
  seatOpp: '#e05b4c',
  wood: '#0c1218',
  woodDark: '#070b10',
  woodLight: '#152028',
  chipGold: '#e8c547',
  chipSilver: '#c5cdc9',
  room: '#071016',
  sage: '#7d9b90',
  glass: 'rgba(12, 22, 28, 0.92)',
  team1: '#e8c547',
  team2: '#e05b4c',
};

export const fonts = {
  sans: Platform.OS === 'web' ? 'DM Sans, system-ui, sans-serif' : undefined,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  card: 8,
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export const motion = {
  botPlayMs: 1200,
  botPassMs: 700,
  humanTurnMs: 20000,
  handResultMs: 1700,
  flightMs: 480,
  dealMs: 1100,
  staggerMs: 40,
  trickMs: 280,
  nativeDriver: Platform.OS !== 'web',
};

export const seatToken = ['#e8c547', '#e05b4c', '#e8c547', '#e05b4c'] as const;

export function ensureWebFonts() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const id = 'murlan-dm-sans';
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}
