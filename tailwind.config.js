/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
        secondary: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        accent: {
          50: '#fefbef',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      spacing: {
        '70': '17.5rem',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
};