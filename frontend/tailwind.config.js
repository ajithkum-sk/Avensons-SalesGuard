/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16202b",
        "ink-soft": "#5a6b7c",
        line: "#d3dae1",
        surface: "#eef1f4",
        card: "#ffffff",
        accent: "#0f6b63",
        warn: "#b45309",
        danger: "#a12d2d",
        ok: "#2f6d3f",
        "sidebar-bg": "#16281f",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', '"Cascadia Mono"', "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px", // matches --radius
      },
      fontSize: {
        base: "15px",
      },
    },
  },
  // important: false — we're layering Tailwind alongside existing CSS,
  // not fighting it for specificity
  corePlugins: { preflight: false }, // <- see note below
  plugins: [],
};