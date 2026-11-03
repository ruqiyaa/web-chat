import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function timeNow() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useChat() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [chats, setChats] = useState({});
  const [active, setActive] = useState("group");
  const [unread, setUnread] = useState({});
  const [online, setOnline] = useState([]);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const activeRef = useRef("group");

  useEffect(() => {
    if (!joined) return;
    const socket = io();
    socketRef.current = socket;

    const addTo = (key, line) => 
      setChats((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), {...line, ts: Date.now()}]
      }))

       const bump = (key) =>
      setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));

    socket.on("connect", () => socket.emit("join", name));

    socket.on("message", (msg) => {
      addTo("group", { kind: "message", time: timeNow(), ...msg });
      if (msg.name !== name && activeRef.current !== "group") bump("group");
    });
    socket.on("notice", (note) =>
      addTo("group", { kind: "notice", text: note })
    );

    socket.on("users", (list) => setOnline(list));

    socket.on("private", (msg) => {
      const other = msg.from === name ? msg.to : msg.from;
      addTo(other, {
        kind: "message",
        time: timeNow(),
        name: msg.from,
        text: msg.text,
      });
      if (msg.from !== name && activeRef.current !== other) bump(other);
    });

    socket.on("join_error", (msg) => {
      setError(msg);
      setChats({});
      setUnread({});
      setActive("group");
      activeRef.current = "group";
      setJoined(false);
    });

    return () => socket.disconnect();
  }, [joined, name]);

  function join() {
    const clean = name.trim();
    if (clean) {
      setName(clean);
      setError("");
      setJoined(true);
    }
  }

  function openChat(id) {
    setActive(id);
    activeRef.current = id;
    setUnread((prev) => ({...prev, [id]: 0}))
  }

  function send(text) {
    if (!text.trim()) return;
    if (active === "group") {
      socketRef.current.emit("message", text);
    } else {
      socketRef.current.emit("private", { to: active, text });
    }
  }


  return {
    name, setName, joined, error,
    chats, active, unread, online,
    join, openChat, send,
  };
}