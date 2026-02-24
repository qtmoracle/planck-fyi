export default {
  content: ["./src/**/*.{astro,html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1116",
        surface: "#141821",
        text: "#E8EAF0",
        muted: "#8B93A7",
        accent: "#C9A227",
        border: "#232837",
      },
      maxWidth: {
        content: "1100px",
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
    },
  },
  plugins: [],
};
