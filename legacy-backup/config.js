/* ===== CONFIG — single source of truth ===== */
const CONFIG = {

  // YouTube playlist ID
  playlistId: 'PLRiJDPquklv4',

  // Branding
  title: 'प्यार भरे गीत',
  subtitle: 'Lo-fi love · all night',
  heroTitle: 'प्यार भरे<br>गीत',
  heroSub: 'दो दिल · एक रात',
  trackLabel: 'गीत · बिना रुके',

  // Background images (in assets/ folder)
  backgrounds: {
    day:   { desktop: 'assets/DesktopDay (1).png',   mobile: 'assets/MobileDay (1).png' },
    night: { desktop: 'assets/DesktopNight (1).png', mobile: 'assets/MobileNight (1).png' },
  },

  // Custom Track Sequence (Admin Control)
  // If you want a specific order of videos, paste their YouTube IDs here.
  // Example: ['dQw4w9WgXcQ', 'xyz123']
  // Leave empty [] to use the default playlist order.
  customSequence: [],

  // Default mode
  defaultMode: 'night',   // 'day' or 'night'
  defaultRain: false,

  // Background opacity (0–1)
  bgOpacity: 1,

  // Rain config
  rainDropCount: 120,
  rainColor: 'rgba(180,200,255,0.25)',

  // Particles
  petalCount: 22,
  heartCount: 8,
};
