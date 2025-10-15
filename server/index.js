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

const state = { players: new Map(), revealed: false };
function publicState() {
  return {
    players: Array.from(state.players.entries()).map(([id,p])=>({id,name:p.name,voted:p.vote!==null&&p.vote!==undefined,vote:state.revealed?p.vote:null})),
    revealed: state.revealed
  };
}
function broadcast(){io.emit("state",publicState());}

io.on("connection",socket=>{
  state.players.set(socket.id,{name:`Player ${socket.id.slice(0,5)}`,vote:null});
  broadcast();
  socket.on("setName",name=>{const p=state.players.get(socket.id);if(p){p.name=name||`Player ${socket.id.slice(0,5)}`;broadcast();}});
  socket.on("vote",v=>{const p=state.players.get(socket.id);if(p){p.vote=v;broadcast();}});
  socket.on("reveal",()=>{state.revealed=true;broadcast();});
  socket.on("newGame",()=>{state.revealed=false;for(const p of state.players.values())p.vote=null;broadcast();});
  socket.on("disconnect",()=>{state.players.delete(socket.id);broadcast();});
});

const dist=path.join(__dirname,"..","client","dist");
app.use(express.static(dist));
app.get("*",(_,res)=>res.sendFile(path.join(dist,"index.html")));
const PORT=process.env.PORT||4000;
httpServer.listen(PORT,()=>console.log("Server on "+PORT));
