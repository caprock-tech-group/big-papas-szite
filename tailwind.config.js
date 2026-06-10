/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B0000', // Deep Texas Red
        secondary: '#000000', // Black
        accent: '#F3E2C7', // Warm cream / off white
        brown: '#5B3922', // Smoked brisket brown
      },
      fontFamily: {
        display: ['var(--font-display)', 'Rye', 'serif'],
        body: ['var(--font-body)', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};