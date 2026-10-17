module.exports = {
  content: ["./src/components/SupportChatWidget.tsx"],
  prefix: "sc-",
  important: "#support-chat-root *",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        support: {
          paper: "#f1eee7",
          ink: "#171715",
          muted: "#77736c",
          red: "#e44736",
          line: "rgba(23, 23, 21, .12)",
        },
      },
      fontFamily: {
        support: ["DM Sans", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        "support-panel": "0 24px 80px rgba(23, 23, 21, .22), 0 3px 12px rgba(23, 23, 21, .1)",
      },
    },
  },
};
