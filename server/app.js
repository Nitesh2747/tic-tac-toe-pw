// Builds the server (Express + Socket.IO) but does NOT start listening.
// Keeping "building" apart from "starting" lets a test start its own copy on a random port, while index.js starts the real one.
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import {
  ALLOWED_ORIGINS,
  EVENT_LIMIT,
  EVENT_WINDOW_MS,
  MAX_CONNECTIONS_PER_IP,
} from "./config.js";
import { registerRoomHandlers } from "./handlers/roomHandlers.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";
import { registerLobbyHandlers } from "./handlers/lobbyHandlers.js";
import { registerChatHandlers } from "./handlers/chatHandlers.js";
import { getClientIp } from "./lib/clientIp.js";
import { createConnectionCounter } from "./lib/connectionLimit.js";
import { guardSocket, limitSocketEvents } from "./lib/safeSocket.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: ALLOWED_ORIGINS }));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: ALLOWED_ORIGINS },
    maxHttpBufferSize: 10_000, // our messages are tiny; refuse anything big.
    // A browser always says which site it is on. Refuse other websites here, so they cannot use this server as their own backend. (Programs that send no Origin header are let through: this is a browser-level guard, not a password.)
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const allowed = !origin || ALLOWED_ORIGINS.includes(origin);
      callback(allowed ? null : "Origin not allowed", allowed);
    },
  });

  // One machine must not be able to open thousands of connections.
  const connections = createConnectionCounter();
  io.use((socket, next) => {
    if (connections.count(getClientIp(socket)) >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error("Too many connections from your address"));
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log("connected:", socket.id);
    const ip = getClientIp(socket);
    connections.add(ip);
    socket.once("disconnect", () => connections.remove(ip));

    guardSocket(socket); // a throwing handler is logged, never fatal
    limitSocketEvents(socket, { limit: EVENT_LIMIT, windowMs: EVENT_WINDOW_MS });
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerLobbyHandlers(io, socket);
    registerChatHandlers(io, socket);
  });

  return { app, httpServer, io };
}