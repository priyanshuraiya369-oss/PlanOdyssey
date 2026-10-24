import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        slate: "#667085",
        canvas: "#f7f8fc",
        lavender: "#7567f8",
        mint: "#42b89a",
        peach: "#ff9b75",
        line: "#e7eaf1"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(34, 44, 78, 0.07)",
        card: "0 8px 24px rgba(29, 39, 75, 0.06)"
      },
      borderRadius: {
        "3xl": "1.75rem"
      }
    }
  },
  plugins: []
};

export default config;
