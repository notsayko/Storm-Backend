import express from "express";
import mongoose from "mongoose";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import log from "./services/logger";
import config from "./services/config";
import { createError } from "./services/error";
import kv from "./services/kv";
import {
    securityHeaders,
    requestSizeGuard,
    ipNormalise,
    authLimiter,
    apiLimiter,
    strictLimiter,
    generalLimiter
} from "./services/security";

import "./services/tokens";

import authRoutes from "./routes/auth";
import vbucksRoutes from "./routes/vbucks";
import launcherRoutes from "./routes/launcher";
import mainRoutes from "./routes/main";
import leaderboardRoutes from "./routes/leaderboard";

if (!existsSync("./data")) mkdirSync("./data");
if (!existsSync("./data/tokens.json")) {
    writeFileSync("./data/tokens.json", JSON.stringify({ accessTokens: [], refreshTokens: [], clientTokens: [] }, null, 2));
}
if (!existsSync("./ClientSettings")) mkdirSync("./ClientSettings");

(globalThis as any).kv = kv;
(globalThis as any).Clients = [];

const app = express();
const PORT = config.port;

app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(ipNormalise as any);
app.use(requestSizeGuard);
app.use(generalLimiter);

app.use((req, res, next) => {
    if (req.method === "PUT" && req.url.includes("/cloudstorage/user")) return next();
    express.json({ limit: "512kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

app.use("/account/api/oauth/token", authLimiter);
app.use("/account/api/public/account", apiLimiter);
app.use("/fortnite/api/game/v2/profile", apiLimiter);
app.use("/api/storm/vbucks", strictLimiter);

app.use(authRoutes);
app.use(vbucksRoutes);
app.use(launcherRoutes);
app.use(leaderboardRoutes);
app.use(mainRoutes);

app.use((req, res) => {
    log.debug(`Missing endpoint: ${req.method} ${req.originalUrl}`);
    if (req.url.includes("..")) {
        res.redirect("https://discord.gg/stormfn");
        return;
    }
    createError(
        "sayko.route.errors.use.v2",
        "thanks for using sayko v2",
        undefined, 1004, undefined, 404, res
    );
});

app.use((err: any, _req: any, res: any, _next: any) => {
    log.error("Unhandled route error:", err?.message || err);
    if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
    }
});

process.on("unhandledRejection", (reason: any) => {
    log.error("Unhandled promise rejection:", reason?.message || reason);
});

process.on("uncaughtException", (err: any) => {
    log.error("Uncaught exception:", err?.message || err);
});

mongoose.set("strictQuery", true);
mongoose.connect(config.mongodb.database).then(() => {
    log.backend("Connected to MongoDB.");
}).catch(err => {
    log.error("MongoDB connection failed:", err);
    process.exit(1);
});

const server = app.listen(PORT, () => {
    log.backend(`Storm Backend listening on port ${PORT}`);

    if (config.discord.bUseDiscordBot) {
        import("./bot/index");
    }
});
import { WebSocketServer } from "ws";
import http from "http";
import handleMatchmaking from "./matchmaker/index";

const MATCHMAKER_PORT = parseInt((config.matchmakerIP || "127.0.0.1:80").split(":").pop() || "80");
const wsApp = http.createServer();
const wss = new WebSocketServer({ server: wsApp });

(globalThis as any).Clients = (globalThis as any).Clients || [];

wss.on("connection", (ws) => {
    if ((ws as any).protocol?.toLowerCase() !== "xmpp") {
        log.backend("Matchmaker: player connected");
        handleMatchmaking(ws);
        return;
    }
    ws.close();
});

wsApp.listen(MATCHMAKER_PORT, "0.0.0.0", () => {
    log.backend(`Matchmaker WebSocket listening on port ${MATCHMAKER_PORT} (0.0.0.0)`);
});

export default app;
