/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#215E61',
        'primary-dark': '#233D4D',
        accent: '#FE7F2D',
        'bg-soft': '#F5FBE6'
      },
      animation: {
        'spin-slow': 'spin 1.6s linear infinite'
      }
    }
  },
  plugins: [require('tailwind-scrollbar-hide')]
}
