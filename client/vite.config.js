import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // const env = loadEnv(mode, process.cwd(), "VITE_");
  // if (mode === "production" && !env.VITE_SERVER_URL) {
  //   throw new Error(
  //     "VITE_SERVER_URL is not set. Set it to your deployed server URL " +
  //       "(e.g. https://my-server.onrender.com) before building."
  //   );
  // }

  return { 
    plugins: [react()],
    server: { host: true },
  };
});