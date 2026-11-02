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
  const listRef = useRef(null);

  useEffect(() => {
    if (!joined) return;
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join", name));
    socket.on("message", (msg) =>
      setLines((prev) => [
        ...prev,
        { kind: "message", time: timeNow(), ...msg },
      ]),
    );
    socket.on("notice", (note) =>
      setLines((prev) => [...prev, { kind: "notice", text: note }]),
    );

    return () => socket.disconnect();
  }, [joined, name]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

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
      <div className="join">
        <form className="join-card" onSubmit={join}>
          <h1>Join the chat</h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="You name"
            autoFocus
          />
          <button type="submit" className="primary">
            Join
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <div className="avatar">{name.trim()[0].toUpperCase()}</div>
        <div>
          <div className="title">Group Chat</div>
          <div className="sub">You are {name}</div>
        </div>
      </header>

      <ul className="messages" ref={listRef}>
        {lines.map((line, i) =>
          line.kind === "notice" ? (
            <li key={i} className="notice">
              {line.text}
            </li>
          ) : (
            <li
              key={i}
              className={line.name === name ? "bubble mine" : "bubble theirs"}
            >
              {line.name !== name && <span className="who">{line.name}</span>}
              <span>{line.text}</span>
              <span className="time">{line.time}</span>
            </li>
          ),
        )}
      </ul>

      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          aria-label="Message"
        />
        <button type="submit" className="send" aria-label="Send">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
