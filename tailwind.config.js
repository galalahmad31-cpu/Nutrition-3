/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ["Cairo", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#eef7f6",
          100: "#d9efec",
          500: "#178f84",
          600: "#11786f",
          700: "#0d625b",
          800: "#0b504b"
        }
      }
    }
  },
  plugins: []
};
