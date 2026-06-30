/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#1B3A5C',
          light: '#EBF2FA',
        },
        critical: {
          DEFAULT: '#C0392B',
          bg: '#FDF2F2',
          border: '#F5C6C6',
        },
        serious: {
          DEFAULT: '#D47C0F',
          bg: '#FEF9EE',
          border: '#F5DFA0',
        },
        stable: {
          DEFAULT: '#2E7D5E',
          bg: '#F0FAF5',
          border: '#A8D5BE',
        },
      },
      animation: {
        'ring-countdown': 'ringCountdown 15s linear forwards',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        ringCountdown: {
          from: { strokeDashoffset: '0' },
          to: { strokeDashoffset: '283' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
