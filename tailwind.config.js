/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          accent: '#7864D7',
          lavender: '#D7CDF5',
          sand: '#FDD7B9',
          mint: '#BEEBEB'
        }
      }
    },
  },
  plugins: [],
}
