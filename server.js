import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import express from "express";
import { Server } from "socket.io";

export const MAX_MESSAGES = 150;
export const MAX_MESSAGE_LENGTH = 400;
export const ALLOWED_REACTIONS = Object.freeze(["❤️", "☕", "🌧️", "✨"]);
export const ALLOWED_ENVIRONMENTS = new Set(["monsoon", "winter", "spring", "autumn", "desert", "coast"]);

const PRODUCTION_FRONTEND_ORIGIN = "https://baarishfm.vercel.app";

const DEFAULT_BLOCKED_WORDS = ["madarchod", "bhenchod"];
const blockedWords = (process.env.CHAT_BLOCKED_WORDS || DEFAULT_BLOCKED_WORDS.join(","))
  .split(",")
  .map((word) => word.trim().toLocaleLowerCase())
  .filter(Boolean);

function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/gu, " ").trim();
  if (name.length < 2 || name.length > 24 || /[\u0000-\u001f\u007f]/u.test(name)) return null;
  return name;
}

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/gu, "\n").trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) return null;
  return text;
}

function containsBlockedWord(text) {
  const normalized = text.toLocaleLowerCase();
  return blockedWords.some((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(normalized));
}

function publicMessage(message) {
  return {
    id: message.id,
    name: message.name,
    text: message.text,
    createdAt: message.createdAt,
    environment: message.environment,
    replyTo: message.replyTo,
    reactions: Object.fromEntries(ALLOWED_REACTIONS.map((reaction) => [reaction, message.reactions[reaction].size]))
  };
}

function createRateGate() {
  const buckets = new Map();
  return (socketId, action, max, windowMs, minGap = 0) => {
    const key = `${socketId}:${action}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
    if ((recent.length && now - recent.at(-1) < minGap) || recent.length >= max) return false;
    recent.push(now);
    buckets.set(key, recent);
    return true;
  };
}

export function createChatApplication() {
  const app = express();
  app.disable("x-powered-by");
  const server = http.createServer(app);
  const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/u, "");
  const allowedOrigins = new Set([
    PRODUCTION_FRONTEND_ORIGIN,
    ...String(process.env.CHAT_ALLOWED_ORIGINS || "").split(",").map(normalizeOrigin).filter(Boolean)
  ]);
  const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin);
  const isAllowedOrigin = (origin) => !origin || allowedOrigins.has(normalizeOrigin(origin)) || isLocalOrigin(origin);
  const io = new Server(server, {
    maxHttpBufferSize: 16_384,
    allowRequest(request, callback) {
      callback(null, isAllowedOrigin(request.headers.origin));
    },
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) callback(null, true);
        else callback(new Error("Origin is not allowed for Chai Pe Chat."));
      },
      methods: ["GET", "POST"]
    }
  });

  const messages = [];
  const participants = new Map();
  const allowAction = createRateGate();
  const duplicateState = new Map();

  const findMessage = (id) => messages.find((message) => message.id === id && !message.hidden);
  const presence = () => io.emit("presence:update", { count: participants.size });
  const addMessage = (message) => {
    messages.push(message);
    if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
  };
  const getRecentMessages = () => messages.filter((message) => !message.hidden).map(publicMessage);

  io.on("connection", (socket) => {
    socket.on("chat:join", (payload = {}, acknowledge = () => {}) => {
      const name = cleanName(payload.name);
      if (!name) return acknowledge({ ok: false, error: "Naam 2–24 saaf characters ka hona chahiye." });
      participants.set(socket.id, { name, joinedAt: Date.now() });
      socket.emit("chat:init", { messages: getRecentMessages(), presence: participants.size });
      presence();
      return acknowledge({ ok: true });
    });

    socket.on("chat:leave", () => {
      if (participants.delete(socket.id)) presence();
    });

    socket.on("chat:name", (payload = {}, acknowledge = () => {}) => {
      const participant = participants.get(socket.id);
      const name = cleanName(payload.name);
      if (!participant || !name) return acknowledge({ ok: false, error: "Naam update nahi hua." });
      participant.name = name;
      return acknowledge({ ok: true, name });
    });

    socket.on("chat:message", (payload = {}, acknowledge = () => {}) => {
      const participant = participants.get(socket.id);
      if (!participant) return acknowledge({ ok: false, error: "Pehle mehfil mein aao." });
      if (!allowAction(socket.id, "message", 5, 10_000, 900)) return acknowledge({ ok: false, error: "Thoda aaram se — chai ka ek ghoont le lo." });
      const text = cleanText(payload.text);
      if (!text) return acknowledge({ ok: false, error: `Message 1–${MAX_MESSAGE_LENGTH} characters ka hona chahiye.` });
      if (containsBlockedWord(text)) return acknowledge({ ok: false, error: "Is lafz ko mehfil se bahar rakhein." });
      const previous = duplicateState.get(socket.id);
      if (previous?.text === text && Date.now() - previous.at < 12_000) return acknowledge({ ok: false, error: "Wahi baat dobara bahut jaldi ho gayi." });
      duplicateState.set(socket.id, { text, at: Date.now() });

      const environment = ALLOWED_ENVIRONMENTS.has(payload.environment) ? payload.environment : "monsoon";
      const original = typeof payload.replyTo === "string" ? findMessage(payload.replyTo) : null;
      const message = {
        id: randomUUID(),
        ownerSocketId: socket.id,
        name: participant.name,
        text,
        createdAt: new Date().toISOString(),
        environment,
        replyTo: original ? { id: original.id, name: original.name, text: original.text.slice(0, 96) } : null,
        reactions: Object.fromEntries(ALLOWED_REACTIONS.map((reaction) => [reaction, new Set()])),
        reports: new Set(),
        hidden: false
      };
      addMessage(message);
      const outgoing = publicMessage(message);
      io.emit("chat:message", outgoing);
      return acknowledge({ ok: true, message: outgoing });
    });

    socket.on("chat:reaction", (payload = {}, acknowledge = () => {}) => {
      if (!participants.has(socket.id) || !allowAction(socket.id, "reaction", 16, 8_000, 120)) return acknowledge({ ok: false, error: "Reactions thodi dheere." });
      const message = typeof payload.messageId === "string" ? findMessage(payload.messageId) : null;
      const reaction = ALLOWED_REACTIONS.includes(payload.reaction) ? payload.reaction : null;
      if (!message || !reaction) return acknowledge({ ok: false, error: "Reaction nahi lagi." });
      const users = message.reactions[reaction];
      const active = !users.has(socket.id);
      if (active) users.add(socket.id);
      else users.delete(socket.id);
      io.emit("chat:reaction", { messageId: message.id, reactions: publicMessage(message).reactions });
      return acknowledge({ ok: true, active });
    });

    socket.on("chat:report", (payload = {}, acknowledge = () => {}) => {
      if (!participants.has(socket.id) || !allowAction(socket.id, "report", 5, 60_000, 800)) return acknowledge({ ok: false, error: "Report abhi nahi bhej paaye." });
      const message = typeof payload.messageId === "string" ? findMessage(payload.messageId) : null;
      if (!message) return acknowledge({ ok: false, error: "Message nahi mila." });
      message.reports.add(socket.id);
      if (message.reports.size >= 3) {
        message.hidden = true;
        io.emit("chat:delete", { messageId: message.id });
      }
      return acknowledge({ ok: true });
    });

    socket.on("disconnect", () => {
      if (participants.delete(socket.id)) presence();
      duplicateState.delete(socket.id);
    });
  });

  const health = (_request, response) => response.json({ ok: true, service: "chai-pe-chat" });
  app.get("/health", health);
  app.get("/chat/health", health);
  const root = path.dirname(fileURLToPath(import.meta.url));
  if (process.env.NODE_ENV !== "production") {
    app.use(express.static(root, { extensions: ["html"] }));
    app.get("*path", (_request, response) => response.sendFile(path.join(root, "index.html")));
  }

  return { app, server, io, store: { messages, participants, getRecentMessages } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  const { server, io } = createChatApplication();
  server.listen(port, "0.0.0.0", () => console.log(`Chai Pe Chat listening on port ${port}`));

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing Chai Pe Chat connections.`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    io.close(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
