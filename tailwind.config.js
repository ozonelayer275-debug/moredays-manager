/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f0eb',
          100: '#e8ddd4',
          200: '#d4bfad',
          300: '#bc9d84',
          400: '#a67d5d',
          500: '#8c6340',
          600: '#6e4d31',
          700: '#523a25',
          800: '#38271a',
          900: '#1f160e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

