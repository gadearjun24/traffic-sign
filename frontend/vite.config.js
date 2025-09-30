import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/socket.io": {
        target:
          "https://ideal-space-xylophone-wr7vv7vr9w67cr5r-5000.app.github.dev",
        ws: true,
      },
    },
  },
});
