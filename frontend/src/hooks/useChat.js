import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api";

const NO_FRIENDS = { friends: [], incoming: [], outgoing: [], loaded: false };

// Today's messages show the time; older ones show the date and the time.
function fmtTime(ts) {
  const d = new Date(ts);
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return t;
  return d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + t;
}

// A message from the server -> a line the chat window can draw.
function toLine(m) {
  return { kind: "message", id: m.id, name: m.from, text: m.text, ts: m.ts, time: fmtTime(m.ts) };
}

// Combine two lists of saved messages: no duplicates (same id), oldest first.
function mergeById(a, b) {
  const map = new Map(a.map((l) => [l.id, l]));
  for (const l of b) if (!map.has(l.id)) map.set(l.id, l);
  return [...map.values()].sort((x, y) => x.id - y.id);
}

export function useChat(user) {
  const name = user.username;
  const [chats, setChats] = useState({});
  const [active, setActive] = useState("group");
  const [unread, setUnread] = useState({});
  const [online, setOnline] = useState([]);                 // friends who are online
  const [friendData, setFriendData] = useState(NO_FRIENDS);
  const [loaded, setLoaded] = useState({});                 // chats whose history is loaded
  const [typingFrom, setTypingFrom] = useState({});         // { username: true while typing }
  const [problem, setProblem] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const activeRef = useRef("group");
  const requested = useRef(new Set());                      // history already requested
  const problemTimer = useRef(null);
  const typingTimers = useRef({});                          // expiry timers, one per person
  const lastTypingSent = useRef(0);

  const loadFriends = useCallback(async () => {
    try {
      const res = await api("/api/friends");
      if (res.ok) setFriendData({ ...res.data, loaded: true });
    } catch {
      // offline: keep what we have
    }
  }, []);

  const markRead = useCallback((username) => {
    api(`/api/messages/${encodeURIComponent(username)}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const loadHistory = useCallback(async (id) => {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    try {
      const res = await api(`/api/messages/${encodeURIComponent(id)}`);
      if (res.ok) {
        const lines = res.data.messages.map(toLine);
        setChats((prev) => ({ ...prev, [id]: mergeById(prev[id] || [], lines) }));
        setLoaded((prev) => ({ ...prev, [id]: true }));
      } else {
        requested.current.delete(id);
      }
    } catch {
      requested.current.delete(id);
    }
  }, []);

  // Last message and unread count for every friend (sidebar previews and badges).
  const loadConversations = useCallback(async () => {
    try {
      const res = await api("/api/conversations");
      if (!res.ok) return;
      const convs = res.data.conversations;
      const counts = {};
      for (const [u, c] of Object.entries(convs)) {
        counts[u] = u === activeRef.current ? 0 : c.unread;
      }
      setUnread((prev) => ({ ...prev, ...counts }));
      setChats((prev) => {
        const next = { ...prev };
        for (const [u, c] of Object.entries(convs)) {
          if (c.last) next[u] = mergeById(next[u] || [], [toLine(c.last)]);
        }
        return next;
      });
      if (activeRef.current !== "group") markRead(activeRef.current);
    } catch {
      // offline: keep what we have
    }
  }, [markRead]);

  // username -> profile card, for friends only
  const profiles = useMemo(
    () => Object.fromEntries(friendData.friends.map((f) => [f.username, f])),
    [friendData]
  );

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    loadFriends();

    // lobby lines only: they are not stored, so the browser stamps them
    const addTo = (key, line) =>
      setChats((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), { ...line, ts: Date.now() }],
      }));
    const bump = (key) =>
      setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));

    // Show or clear "typing..." for one person; it clears itself after 4 seconds.
    const setTyping = (u, on) => {
      clearTimeout(typingTimers.current[u]);
      if (on) {
        typingTimers.current[u] = setTimeout(
          () => setTypingFrom((p) => ({ ...p, [u]: false })),
          4000
        );
      }
      setTypingFrom((p) => ({ ...p, [u]: on }));
    };

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("presence_request");
      loadConversations();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("presence_list", (list) => setOnline(list));
    socket.on("presence", ({ username, online: isOn }) => {
      if (!isOn) setTyping(username, false);               // gone offline: no longer typing
      setOnline((prev) =>
        isOn
          ? prev.includes(username) ? prev : [...prev, username]
          : prev.filter((u) => u !== username)
      );
    });
    socket.on("friends_changed", () => {
      loadFriends();
      socket.emit("presence_request");
    });

    socket.on("typing", ({ from, typing }) => setTyping(from, typing === true));

    socket.on("message", (msg) => {
      addTo("group", { kind: "message", time: fmtTime(Date.now()), ...msg });
      if (msg.name !== name && activeRef.current !== "group") bump("group");
    });
    socket.on("notice", (note) => addTo("group", { kind: "notice", text: note }));

    socket.on("private", (msg) => {
      const other = msg.from === name ? msg.to : msg.from;
      const line = toLine(msg);
      setChats((prev) => ({ ...prev, [other]: mergeById(prev[other] || [], [line]) }));
      if (msg.from !== name) {
        setTyping(msg.from, false);                         // their message arrived
        if (activeRef.current === other) markRead(other);   // you are looking at it
        else bump(other);
      }
    });

    socket.on("problem", (text) => {
      setProblem(text);
      clearTimeout(problemTimer.current);
      problemTimer.current = setTimeout(() => setProblem(""), 4000);
    });

    return () => {
      clearTimeout(problemTimer.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
      socket.disconnect();
    };
  }, [name, loadFriends, loadConversations, markRead]);

  // If the person you were chatting with stops being your friend, go back to the Lobby.
  useEffect(() => {
    if (friendData.loaded && active !== "group" && !profiles[active]) openChat("group");
  }, [friendData, active, profiles]);

  function openChat(id) {
    setActive(id);
    activeRef.current = id;
    setUnread((prev) => ({ ...prev, [id]: 0 }));
    if (id !== "group") {
      markRead(id);
      loadHistory(id);
    }
  }

  function send(text) {
    if (!text.trim()) return;
    if (active === "group") socketRef.current.emit("message", text);
    else socketRef.current.emit("private", { to: active, text });
  }

  // Tell the open friend we are typing (at most once every 2.5 seconds).
  function typing(isTyping) {
    const to = activeRef.current;
    if (to === "group") return;
    const now = Date.now();
    if (isTyping) {
      if (now - lastTypingSent.current < 2500) return;
      lastTypingSent.current = now;
    } else {
      lastTypingSent.current = 0;
    }
    socketRef.current?.emit("typing", { to, typing: isTyping });
  }

  return {
    name, chats, active, unread, online, profiles, loaded, problem, typingFrom,
    friendData, loadFriends, connected, openChat, send, typing,
  };
}