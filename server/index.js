import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// In-memory state
const state = { players: new Map(), revealed: false, adminId: null };

function publicState() {
  return {
    players: Array.from(state.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      voted: p.vote !== null && p.vote !== undefined,
      vote: state.revealed ? p.vote : null,
    })),
    revealed: state.revealed,
    adminId: state.adminId
  };
}

function broadcast() { io.emit("state", publicState()); }

io.on("connection", socket => {
  // first connection becomes admin
  if (!state.adminId) state.adminId = socket.id;
  state.players.set(socket.id, { name: `Player ${socket.id.slice(0,5)}`, vote: null });
  broadcast();

  socket.on("setName", name => {
    const trimmed = String(name || "").trim().slice(0, 40) || `Player ${socket.id.slice(0,5)}`;
    const p = state.players.get(socket.id);
    if (p) { p.name = trimmed; broadcast(); }
  });

  // number | "?" | "coffee" | null
  socket.on("vote", v => {
    const p = state.players.get(socket.id);
    if (!p) return;
    if (v === null || v === "?" || v === "coffee" || Number.isFinite(v)) { p.vote = v; broadcast(); }
  });

  socket.on("reveal", () => { state.revealed = true; broadcast(); });

  socket.on("newGame", () => { state.revealed = false; for (const p of state.players.values()) p.vote = null; broadcast(); });

  // kick allowed only for admin
  socket.on("kick", (targetId) => {
    if (socket.id !== state.adminId) return; // not admin
    if (!targetId || targetId === state.adminId) return; // cannot kick self/admin
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      // notify target and disconnect
      targetSocket.emit("kicked");
      targetSocket.disconnect(true);
    }
    if (state.players.has(targetId)) {
      state.players.delete(targetId);
      broadcast();
    }
  });

  socket.on("disconnect", () => {
    // if admin leaves, assign next connected as admin
    state.players.delete(socket.id);
    if (state.adminId === socket.id) {
      const next = state.players.keys().next();
      state.adminId = next.done ? null : next.value;
    }
    broadcast();
  });
});

// Serve client build
const distPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log("✅ Server listening on http://localhost:" + PORT));
