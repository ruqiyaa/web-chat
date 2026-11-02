import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

function timeNow() {
  return new Date().toLocaleDateString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [lines, setLines] = useState([]);
  const [text, setText] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    if (!joined) return;
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join", name));
    socket.on("message", (msg) =>
      setLines((prev) => [...prev, { kind: "message", ...msg }]),
    );
    socket.on("notice", (note) =>
      setLines((prev) => [...prev, { kind: "notice", text: note }]),
    );

    return () => socket.disconnect();
  }, [joined, name]);

  function join(e) {
    e.preventDefault();
    if (name.trim()) setJoined(true);
  }

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current.emit("message", text);
    setText("");
  }

  if (!joined) {
    return (
      <form onSubmit={join}>
        <h1>Join the chat</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your naem"
          autoFocus
        />
        <button type="submit">Join</button>
      </form>
    );
  }

  return (
    <div>
      <h1>Chat as {name}</h1>
      <ul>
        {lines.map((line, i) => (
          <li key={i}>
            {line.kind === "notice"
              ? `*** ${line.text} ***`
              : `${line.name}: ${line.text}`}
          </li>
        ))}
      </ul>

      <form onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
