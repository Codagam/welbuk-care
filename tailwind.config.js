/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Welbuk brand — magenta #FD006A (identical to Practice --brand)
        brand: {
          DEFAULT: "#FD006A",
          foreground: "#FFFFFF",
          50: "#FFF0F6",
          100: "#FFE0EC",
          200: "#FFB3D0",
          300: "#FF80B0",
          400: "#FF3D8A",
          500: "#FD006A",
          600: "#D60059",
          700: "#A80046",
          800: "#7A0033",
          900: "#520022",
        },
        primary: { DEFAULT: "#FD006A", foreground: "#FFFFFF" },
      },
    },
  },
  plugins: [],
};
