// Starts the real server. Everything that BUILDS it lives in app.js.
import { ALLOWED_ORIGINS, PORT, TRUST_PROXY } from "./config.js";
import { createApp } from "./app.js";
import { getStartupWarnings } from "./lib/startupChecks.js";

for (const warning of getStartupWarnings({ env: process.env, trustProxy: TRUST_PROXY, origins: ALLOWED_ORIGINS })) {
  console.warn(`WARNING: ${warning}`);
}

// A promise nobody waited for failed: log it, keep serving.
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
// An error nothing caught (for example inside a timer): the server's memory may be in an unknown state, so log it and exit. The host restarts the server with a clean slate.
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

const { httpServer, io } = createApp();

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref(); // don't hang forever
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));