/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./forms/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFF",
        border: "#DDE8FF",
        destructive: "#D92D20",
        "destructive-border": "#FECACA",
        "destructive-surface": "#FEF2F2",
        foreground: "#17315F",
        muted: "#EEF4FF",
        "muted-foreground": "#6C7A96",
        primary: "#346EF6",
        "primary-hover": "#2558D8",
        "subtle-foreground": "#91A0B8",
        success: "#047857",
        "success-border": "#BBF7D0",
        "success-surface": "#ECFDF5",
        surface: "#FFFFFF",
        warning: "#806128",
        "warning-border": "#FFE7A6",
        "warning-surface": "#FFF9E8",
      },
    },
  },
  plugins: [],
};
