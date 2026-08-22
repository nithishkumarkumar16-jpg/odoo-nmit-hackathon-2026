/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5', // Sleek Indigo brand accent
          light: '#EEF2FF',
          dark: '#3730A3',
        },
        surface: '#F8F9FB',
        border: '#E5E7EB',
        status: {
          present: '#16A34A', // green
          pending: '#D97706', // amber
          absent: '#D97706',  // yellow/amber per the wireframe absent=yellow convention
          leave: '#2563EB',   // neutral blue for on-leave
          rejected: '#DC2626' // red for rejected
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
