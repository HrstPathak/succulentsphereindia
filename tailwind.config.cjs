/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#344E41",
          700: "#A3B18A",
          500: "#CB997E",
          bg: "#F5F3EF",
          text: "#2B2B2B"
        }
      },
      fontFamily: {
        serif: ["var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"]
      }
    }
  },
  darkMode: "class",
  plugins: [require("@tailwindcss/typography")]
};
