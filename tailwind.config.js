export default {
  content: ["./app/**/*.{js,jsx,mdx}", "./components/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--page-bg)",
        foreground: "var(--pt-150)",
        muted: "var(--pt-400)",
        border: "var(--pt-600)",
        accent: "var(--brand-primary)"
      },
      borderRadius: {
        sm: "var(--glass-blur-radius)",
        md: "var(--glass-blur-radius)",
        lg: "var(--glass-blur-radius)"
      }
    }
  },
  plugins: []
};
