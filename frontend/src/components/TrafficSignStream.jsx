// src/components/TrafficSignStream.jsx
import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function TrafficSignStream() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [fps] = useState(5); // send 5 fps frames to backend
  const clientId = useRef("client-" + Math.random().toString(36).slice(2, 9));

  // use Codespaces origin → auto picks ws:// or wss://
  const wsUrl =
    "https://ideal-space-xylophone-wr7vv7vr9w67cr5r-5000.app.github.dev";

  useEffect(() => {
    // 🎥 start camera
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (err) {
        console.error("Camera error:", err);
      }
    }
    startCamera();

    // 🔌 connect socket.io
    (socketRef.current = io(wsUrl)),
      {
        transports: ["websocket"],
      };
    socketRef.current.on("connect", () => setConnected(true));
    socketRef.current.on("disconnect", () => setConnected(false));

    // detections from backend
    socketRef.current.on("detections", (msg) => {
      if (msg && msg.detections) {
        drawDetections(msg.detections);
      }
    });

    // return () => {
    //   socketRef.current?.disconnect();
    //   const tracks = videoRef.current?.srcObject?.getTracks() || [];
    //   tracks.forEach((t) => t.stop());
    // };
  }, [wsUrl]);

  useEffect(() => {
    console.log(new Date());
    let interval;
    function captureAndSend() {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        !socketRef.current?.connected
      )
        return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);

      // compress frame to JPEG base64
      canvas.toBlob(
        async (blob) => {
          const buf = await blob.arrayBuffer();
          const b64 = arrayBufferToBase64(buf);
          const message = {
            type: "frame",
            clientId: clientId.current,
            timestamp: Date.now(),
            width: w,
            height: h,
            frame: b64,
          };
          socketRef.current.emit("frame", message);
        },
        "image/jpeg",
        0.7
      );
    }

    interval = setInterval(captureAndSend, Math.round(1000 / fps));
    return () => clearInterval(interval);
  }, [fps]);

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function drawDetections(detections) {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;

    overlay.width = canvas.width;
    overlay.height = canvas.height;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
    ctx.font = `${Math.max(12, Math.round(canvas.width / 80))}px Arial`;

    detections.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox;
      ctx.strokeStyle = "red";
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.stroke();

      const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
      const textW = ctx.measureText(label).width + 6;
      ctx.fillRect(x1, y1 - 22, textW, 20);
      ctx.fillStyle = "white";
      ctx.fillText(label, x1 + 3, y1 - 6);
      ctx.fillStyle = "red";
    });
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 960 }}>
      <video ref={videoRef} style={{ width: "100%" }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <canvas
        ref={overlayRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <div style={{ marginTop: 8 }}>
        <strong>Socket.io:</strong>{" "}
        {connected ? "connected ✅" : "connecting..."}
      </div>
    </div>
  );
}
