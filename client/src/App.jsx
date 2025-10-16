import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  AppBar, Toolbar, Typography, Button, Box, Grid, Paper, Stack, Avatar,
  Divider, Chip, useMediaQuery, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CssBaseline
} from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const DECK = [
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
  d.setTime(d.getTime() + days*24*60*60*1000);
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
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');
  const [themeMode, setThemeMode] = useState(getCookie("pp_theme") || "light");
  const theme = useMemo(() => createTheme({ palette: { mode: themeMode } }), [themeMode]);
  useEffect(() => { setCookie("pp_theme", themeMode); }, [themeMode]);

  // connect after name known
  useEffect(() => {
    const saved = getCookie("pp_name");
    if (!saved) { setNameDialogOpen(true); return; }
    setName(saved);
    const s = io(SERVER_URL, { transports: ["websocket"] });
    setSocket(s);
    s.on("state", st => setRemote(st));
    s.on("connect", () => s.emit("setName", saved));
    return () => s.disconnect();
  }, []);

  const openNameDialog = () => setNameDialogOpen(true);
  const submitName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCookie("pp_name", trimmed);
    if (!socket) {
      const s = io(SERVER_URL, { transports: ["websocket"] });
      setSocket(s);
      s.on("state", st => setRemote(st));
      s.on("connect", () => s.emit("setName", trimmed));
    } else {
      socket.emit("setName", trimmed);
    }
    setNameDialogOpen(false);
  };

  const handleVote = (v) => { if (!socket) return; setMyVote(v); socket.emit("vote", v); };
  const handleReveal = () => socket?.emit("reveal");
  const handleNewGame = () => { setMyVote(null); socket?.emit("newGame"); };

  const average = useMemo(() => {
    if (!remote.revealed) return null;
    const nums = remote.players.map(p => p.vote).filter(v => Number.isFinite(v));
    if (nums.length === 0) return "—";
    return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2);
  }, [remote]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, bgcolor: "background.default", minHeight: "100vh" }}>
        <AppBar position="static">
          <Toolbar sx={{ flexWrap: "wrap", gap: 1 }}>
            <CasinoIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1, minWidth: isMobile ? "100%" : "auto" }}>Planning Poker</Typography>
            <Button color="inherit" onClick={openNameDialog}>Change name</Button>
            <Button color="inherit" onClick={handleReveal}>Show cards</Button>
            <Button color="inherit" onClick={handleNewGame}>New game</Button>
            <Button color="inherit" onClick={() => setThemeMode(m => m === "light" ? "dark" : "light")}>
              {themeMode === "light" ? "🌙" : "☀️"}
            </Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
          <Typography variant="h6" gutterBottom>Pick a card 🃏</Typography>
          <Grid container spacing={2} justifyContent="center">
            {DECK.map(card => (
              <Grid item key={card.label}>
                <Paper
                  onClick={() => handleVote(card.value)}
                  sx={{
                    width: isMobile ? 70 : 90,
                    height: isMobile ? 100 : 130,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 22 : 28,
                    borderRadius: 2,
                    boxShadow: myVote === card.value ? "0 0 0 3px #1976d2 inset" : 2,
                    cursor: "pointer",
                    transition: "transform 0.1s",
                    "&:hover": { transform: "scale(1.05)" }
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
                  <Avatar sx={{ bgcolor: p.voted ? "#4caf50" : "#bdbdbd", mr: 2 }}>{p.name?.[0]?.toUpperCase() || "?"}</Avatar>
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

        <Dialog open={nameDialogOpen} onClose={() => {}} fullWidth maxWidth="xs">
          <DialogTitle>Enter your name</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Name"
              type="text"
              fullWidth
              variant="outlined"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitName(); }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNameDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitName} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}
