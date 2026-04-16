/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      colors: {
        // ── CampusGPT Neo-Glass Design System ──────────────────────────────
        bg: {
          base:    '#050505',   // Near-black: main app background
          surface: '#0E0E0E',   // Elevated surfaces (sidebar, panels)
          card:    '#111111',   // Card backgrounds
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.03)',
          hover:   'rgba(255,255,255,0.06)',
          active:  'rgba(255,255,255,0.08)',
        },
        border: {
          dim:    'rgba(255,255,255,0.06)',
          subtle: 'rgba(255,255,255,0.08)',
          muted:  'rgba(255,255,255,0.12)',
          active: 'rgba(0,255,157,0.35)',
        },
        // Primary neon green glow — main accent
        neon: {
          green:      '#00ff9d',
          'green-dim': 'rgba(0,255,157,0.15)',
          'green-glow':'rgba(0,255,157,0.08)',
          teal:       '#00c8ff',
          'teal-dim': 'rgba(0,200,255,0.15)',
          purple:     '#a259ff',
          'purple-dim':'rgba(162,89,255,0.15)',
        },
        text: {
          primary:   '#ffffff',
          secondary: '#a0a0a0',
          muted:     '#5a5a5a',
          accent:    '#00ff9d',
        },
      },
      backgroundImage: {
        // Card gradients
        'card-glow-green':  'linear-gradient(135deg, rgba(0,255,157,0.06) 0%, rgba(0,200,255,0.02) 100%)',
        'card-glow-teal':   'linear-gradient(135deg, rgba(0,200,255,0.06) 0%, rgba(162,89,255,0.02) 100%)',
        'card-glow-purple': 'linear-gradient(135deg, rgba(162,89,255,0.06) 0%, rgba(0,255,157,0.02) 100%)',
        // Sidebar gradient
        'sidebar-gradient': 'linear-gradient(180deg, #0E0E0E 0%, #080808 100%)',
        // Ambient hero glows
        'hero-glow':    'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,255,157,0.08), transparent)',
        'bottom-glow':  'radial-gradient(ellipse 60% 30% at 50% 100%, rgba(0,200,255,0.06), transparent)',
      },
      boxShadow: {
        'neon-green':  '0 0 20px rgba(0,255,157,0.25), 0 0 60px rgba(0,255,157,0.08)',
        'neon-teal':   '0 0 20px rgba(0,200,255,0.25), 0 0 60px rgba(0,200,255,0.08)',
        'neon-purple': '0 0 20px rgba(162,89,255,0.25), 0 0 60px rgba(162,89,255,0.08)',
        'card':        '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.6)',
        'card-hover':  '0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.8)',
        'inset-top':   'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'pulse-neon':   'pulseNeon 2.5s ease-in-out infinite',
        'border-pulse': 'borderPulse 2s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'fade-up':      'fadeUp 0.4s ease-out',
        'slide-in':     'slideIn 0.35s ease-out',
        'glow-ping':    'glowPing 1.5s ease-out',
        'typing':       'typing 1.2s ease-in-out infinite',
        'waveform':     'waveform 1.5s ease-in-out infinite',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(0,255,157,0.3)' },
          '50%':      { opacity: '0.85', boxShadow: '0 0 40px rgba(0,255,157,0.5)' },
        },
        borderPulse: {
          '0%, 100%': { borderColor: 'rgba(0,255,157,0.25)' },
          '50%':      { borderColor: 'rgba(0,255,157,0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPing: {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        typing: {
          '0%, 100%': { opacity: '0.2', transform: 'scale(0.8)' },
          '50%':      { opacity: '1',   transform: 'scale(1)' },
        },
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%':      { transform: 'scaleY(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
