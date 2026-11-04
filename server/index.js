import { PORT } from "./config.js";
import { createApp } from "./app.js";

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