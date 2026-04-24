/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // FC Kairat palette
        kairat: {
          yellow: '#F5C518',
          gold: '#D4A017',
          black: '#0A0A0A',
          dark: '#111111',
        },
        // SNICKERS accent palette
        snickers: {
          red: '#C8102E',
          brown: '#4A2315',
          caramel: '#B8860B',
          cream: '#F5E6C8',
        },
        // UI neutrals
        surface: {
          0: '#0A0A0A',
          1: '#111111',
          2: '#1A1A1A',
          3: '#222222',
          4: '#2A2A2A',
        },
        brand: {
          primary: '#F5C518',
          secondary: '#C8102E',
          accent: '#D4A017',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        'card-legendary': 'linear-gradient(135deg, #1a1200 0%, #3d2e00 50%, #1a1200 100%)',
        'card-epic': 'linear-gradient(135deg, #120020 0%, #2d0050 50%, #120020 100%)',
        'card-rare': 'linear-gradient(135deg, #001230 0%, #003070 50%, #001230 100%)',
        'card-common': 'linear-gradient(135deg, #101010 0%, #1e1e1e 50%, #101010 100%)',
        'pitch': 'linear-gradient(180deg, #1a3a1a 0%, #1e4a1e 50%, #1a3a1a 100%)',
      },
      animation: {
        'card-shine': 'cardShine 2s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        cardShine: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245,197,24,0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(245,197,24,0.7)' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        bounceIn: {
          from: { transform: 'scale(0.8)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
