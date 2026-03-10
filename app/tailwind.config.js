/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Halenoir"', "system-ui", "sans-serif"],
        halenoir: ['"Halenoir"', "system-ui", "sans-serif"],
      },
      colors: {
        amplifi: {
          nav: "#033122",
          amount: "033122",
          muted: "#8A8A8A",
          surface: "#F6F6F6",
          "surface-muted": "#f3f4f6",
          border: "#e5e7eb",
          text: "#010F0B",
          primary: "#033122",
          "primary-hover": "#044d38",
          "best-offer": "#dcfce7",
          "best-offer-text": "#166534",
          btc: "#f97316",
          wbtc: "#8b5cf6",
          "risk-safe": "#00CD3B",
          "risk-safe-bg": "#E6FBED",
          "risk-medium": "#D08700",
          "risk-medium-bg": "#FEF3C7",
          "risk-hard": "#DC2626",
          "risk-hard-bg": "#FEE2E2",
        },
      },
      borderRadius: {
        "amplifi": "0.75rem",
        "amplifi-lg": "1rem",
      },
      boxShadow: {
        amplifi: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
    },
    screens: {
      xs: "360px",
      sm: "600px",
      md: "900px",
      lg: "1200px",
      xl: "1440px",
      "2xl": "1536px",
      // => @media (min-width: 1120px) { ... }
    },
  },
  plugins: [],
};
