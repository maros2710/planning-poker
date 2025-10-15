import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  AppBar, Toolbar, Typography, Button, TextField, Box, Grid, Paper, Stack, Avatar, Divider, Chip
} from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";

// Use same origin in production (Heroku)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

// Cards: Fibonacci without 55, 89 + special "?" and "coffee"
const DECK = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
  { label: "8", value: 8 },
  { label: "13", value: 13 },
  { label: "21", value: 21 },
  { label: "34", value: 34 },
  { label: "?", value: "?" },
  { label: "☕", value: "coffee" }
];

function setCookie(name, value, days = 180) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}
function getCookie(name) {
  const v = `; ${document.cookie}`;
  const parts = v.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return "";
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [name, setName] = useState('');
  const [remote, setRemote] = useState({ players: [], revealed: false });
  const [myVote, setMyVote] = useState(null);

  useEffect(() => {
    const s = io(SERVER_URL, { transports: ["websocket"] });
    setSocket(s);
    s.on("state", st => setRemote(st));
    return () => s.disconnect();
  }, []);

  // Load name from cookie once and send to server
  useEffect(() => {
    const saved = getCookie("pp_name");
    if (saved && socket) {
      setName(saved);
      socket.emit("setName", saved);
    }
  }, [socket]);

  const me = useMemo(() => remote.players.find(p => p.id === socket?.id), [remote.players, socket?.id]);

  const handleVote = (v) => {
    if (!socket) return;
    setMyVote(v);
    socket.emit("vote", v);
  };

  const handleReveal = () => socket?.emit("reveal");
  const handleNewGame = () => { setMyVote(null); socket?.emit("newGame"); };
  const handleSetName = () => {
    socket?.emit("setName", name);
    setCookie("pp_name", name);
  };

  // Average of numeric votes only
  const average = React.useMemo(() => {
    if (!remote.revealed) return null;
    const nums = remote.players.map(p => p.vote).filter(v => Number.isFinite(v));
    if (nums.length === 0) return "—";
    const avg = nums.reduce((a,b)=>a+b,0)/nums.length;
    return avg.toFixed(2);
  }, [remote]);

  return (
    <Box sx={{ flexGrow: 1, bgcolor: "#f6f8fa", minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar>
          <CasinoIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Planning Poker</Typography>
          <TextField
            size="small"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            sx={{ bgcolor: "white", borderRadius: 1, mr: 1, width: 180 }}
          />
          <Button color="inherit" onClick={handleSetName}>Save</Button>
          <Button color="inherit" onClick={handleReveal}>Show cards</Button>
          <Button color="inherit" onClick={handleNewGame}>New game</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>
        <Typography variant="h6" gutterBottom>Pick a card 🃏</Typography>
        <Grid container spacing={2}>
          {DECK.map(card => (
            <Grid item key={card.label}>
              <Paper
                onClick={() => handleVote(card.value)}
                sx={{
                  width: 90,
                  height: 130,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  borderRadius: 2,
                  boxShadow: myVote === card.value ? "0 0 0 3px #1976d2 inset" : 2,
                  cursor: "pointer",
                  transition: "transform 0.1s",
                  "&:hover": { transform: "scale(1.05)" },
                  bgcolor: remote.revealed && myVote === card.value ? "#c8e6c9" : "white",
                  userSelect: "none"
                }}
                title={card.label === "☕" ? "Coffee break" : `Vote ${card.label}`}
              >
                {card.label}
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Players 💬</Typography>
          <Stack spacing={1}>
            {remote.players.map(p => (
              <Paper key={p.id} sx={{ p: 1.5, display: "flex", alignItems: "center" }}>
                <Avatar sx={{ bgcolor: p.voted ? "#4caf50" : "#bdbdbd", mr: 2 }}>
                  {p.name?.[0]?.toUpperCase() || "?"}
                </Avatar>
                <Typography sx={{ flexGrow: 1 }}>{p.name}</Typography>
                <Typography variant="h6" sx={{ minWidth: 48, textAlign: "center" }}>
                  {remote.revealed ? (p.vote ?? "—") : (p.voted ? "✅" : "…")}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>

        {remote.revealed && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }}><Chip label="Result" /></Divider>
            <Typography variant="h6">Average estimate: <b>{average}</b></Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Only numeric votes are included. Non-numeric votes like "?" or "☕" are ignored.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
