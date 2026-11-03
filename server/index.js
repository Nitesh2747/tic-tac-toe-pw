import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { PORT, ALLOWED_ORIGINS } from "./config.js";
import { registerRoomHandlers } from "./handlers/roomHandlers.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";
import { registerLobbyHandlers } from "./handlers/lobbyHandlers.js";
import { registerChatHandlers } from "./handlers/chatHandlers.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: ALLOWED_ORIGINS }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
  maxHttpBufferSize: 10_000, // our messages are tiny; refuse anything big
});

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
  registerLobbyHandlers(io, socket);
  registerChatHandlers(io, socket);
});

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
