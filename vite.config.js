import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = Number.parseInt(env.PORT || process.env.PORT || "3001", 10);
  const supportApiProxy = {
    "/api": {
      target: `http://127.0.0.1:${Number.isInteger(apiPort) && apiPort > 0 && apiPort <= 65535 ? apiPort : 3001}`,
      changeOrigin: false,
    },
  };
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: supportApiProxy,
    },
    preview: {
      host: "127.0.0.1",
      proxy: supportApiProxy,
    },
  };
});
