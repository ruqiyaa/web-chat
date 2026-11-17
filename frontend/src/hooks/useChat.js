import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api";

const NO_FRIENDS = { friends: [], incoming: [], outgoing: [], loaded: false };

// Chat keys: "" means no chat is open, "g:12" is a group, anything else is a friend's username.
const isGroupKey = (id) => id.startsWith("g:");
const groupIdOf = (id) => id.slice(2);
const historyUrl = (id) =>
  isGroupKey(id)
    ? `/api/groups/${groupIdOf(id)}/messages`
    : `/api/messages/${encodeURIComponent(id)}`;
const readUrl = (id) =>
  isGroupKey(id)
    ? `/api/groups/${groupIdOf(id)}/read`
    : `/api/messages/${encodeURIComponent(id)}/read`;

// Today's messages show the time; older ones show the date and the time.
function fmtTime(ts) {
  const d = new Date(ts);
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return t;
  return d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + t;
}

// A message from the server -> a line the chat window can draw.
function toLine(m) {
  return {
    kind: "message", id: m.id, name: m.from, display_name: m.display_name,
    text: m.text, ts: m.ts, time: fmtTime(m.ts),
  };
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
  const [active, setActive] = useState("");                 // "" = nothing open yet
  const [unread, setUnread] = useState({});
  const [online, setOnline] = useState([]);                 // friends who are online
  const [friendData, setFriendData] = useState(NO_FRIENDS);
  const [groups, setGroups] = useState([]);                 // groups I am in
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loaded, setLoaded] = useState({});                 // chats whose history is loaded
  const [typingFrom, setTypingFrom] = useState({});         // { username: true while typing }
  const [problem, setProblem] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const activeRef = useRef("");
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

  const markRead = useCallback((id) => {
    api(readUrl(id), { method: "POST" }).catch(() => {});
  }, []);

  const loadHistory = useCallback(async (id) => {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    try {
      const res = await api(historyUrl(id));
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
      const open = activeRef.current;
      if (open && !isGroupKey(open)) markRead(open);
    } catch {
      // offline: keep what we have
    }
  }, [markRead]);

  // The groups I am in, with each one's last message and unread count.
  const loadGroups = useCallback(async () => {
    try {
      const res = await api("/api/groups");
      if (!res.ok) return;
      const list = res.data.groups;
      setGroups(list);
      setGroupsLoaded(true);
      const counts = {};
      for (const g of list) {
        const key = `g:${g.id}`;
        counts[key] = key === activeRef.current ? 0 : g.unread;
      }
      setUnread((prev) => ({ ...prev, ...counts }));
      setChats((prev) => {
        const next = { ...prev };
        for (const g of list) {
          const key = `g:${g.id}`;
          if (g.last) next[key] = mergeById(next[key] || [], [toLine(g.last)]);
        }
        return next;
      });
      if (isGroupKey(activeRef.current)) markRead(activeRef.current);
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
      loadGroups();
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
    socket.on("groups_changed", () => loadGroups());

    socket.on("typing", ({ from, typing }) => setTyping(from, typing === true));

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

    socket.on("group_message", (msg) => {
      const key = `g:${msg.group_id}`;
      const line = toLine(msg);
      setChats((prev) => ({ ...prev, [key]: mergeById(prev[key] || [], [line]) }));
      if (msg.from !== name) {
        if (activeRef.current === key) markRead(key);       // you are looking at it
        else bump(key);
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
  }, [name, loadFriends, loadConversations, loadGroups, markRead]);

  // If the chat you have open is gone (unfriended, or no longer in that group), close it.
  useEffect(() => {
    if (!active) return;
    if (isGroupKey(active)) {
      if (groupsLoaded && !groups.some((g) => `g:${g.id}` === active)) openChat("");
    } else if (friendData.loaded && !profiles[active]) {
      openChat("");
    }
  }, [friendData, groups, groupsLoaded, active, profiles]);

  function openChat(id) {
    setActive(id);
    activeRef.current = id;
    if (id) {
      setUnread((prev) => ({ ...prev, [id]: 0 }));
      markRead(id);
      loadHistory(id);
    }
  }

  function send(text) {
    if (!text.trim() || !active) return;
    if (isGroupKey(active)) {
      socketRef.current.emit("group_message", { group_id: Number(groupIdOf(active)), text });
    } else {
      socketRef.current.emit("private", { to: active, text });
    }
  }

  // Tell the open friend we are typing (at most once every 2.5 seconds).
  function typing(isTyping) {
    const to = activeRef.current;
    if (!to || isGroupKey(to)) return;                      // no typing signal in groups yet
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
    friendData, loadFriends, groups, loadGroups, connected, openChat, send, typing,
  };
}