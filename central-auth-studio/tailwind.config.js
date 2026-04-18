/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#f0f4ff',
          100: '#d9e2ff',
          200: '#bccaff',
          300: '#94a9ff',
          400: '#667cff',
          500: '#4351ff',
          600: '#2b2fff',
          700: '#1d1eff',
          800: '#1919d1',
          900: '#1a1ba3',
          950: '#0a0a5c',
        },
      },
    },
  },
  plugins: [],
}
