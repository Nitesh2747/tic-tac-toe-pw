import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { ALLOWED_ORIGINS } from "./config.js";
import { registerRoomHandlers } from "./handlers/roomHandlers.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";
import { registerLobbyHandlers } from "./handlers/lobbyHandlers.js";
import { registerChatHandlers } from "./handlers/chatHandlers.js";

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
        maxHttpBufferSize: 10_000, // messages are tiny; refuses anything big
    });

    io.on("connection", (socket) => {
        console.log("connected:", socket.id);
        registerRoomHandlers(io, socket);
        registerGameHandlers(io, socket);
        registerLobbyHandlers(io, socket);
        registerChatHandlers(io, socket);
    });

    return { app, httpServer, io };
}