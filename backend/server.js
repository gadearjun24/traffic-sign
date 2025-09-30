// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins (for testing) OR specify your frontend URL
    methods: ["GET", "POST"],
  },
});
app.use(cors());

// start Python child process
const py = spawn("python", ["detector.py"]);
py.stdout.setEncoding("utf-8");

let pythonBuffer = "";
py.stdout.on("data", (data) => {
  pythonBuffer += data.toString();
  console.log({ data });
  let lines = pythonBuffer.split("\n");
  pythonBuffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      // broadcast detections back to clients
      io.emit("detections", msg);
    } catch (e) {
      console.error("Bad JSON from Python:", line);
    }
  }
});

py.stderr.on("data", (d) => console.error("Python ERR:", d.toString()));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("frame", (frameData) => {
    // send frame to Python
    console.log("frame come");
    py.stdin.write(JSON.stringify(frameData) + "\n");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(5000, () =>
  console.log("🚀 Server running on http://localhost:5000")
);
