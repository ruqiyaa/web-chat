import { useEffect, useRef } from "react";
import Avatar from "./Avatar";

export default function ChatWindow({
  name,
  profiles,
  active,
  group,
  lines,
  peerOffline,
  ready,
  typing,
}) {
  const listRef = useRef(null);

  // Scroll to the bottom when a new message arrives or history finishes loading.
  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastLine, active, ready]);

  const shown = (u) => profiles[u]?.display_name || u;
  const isLobby = active === "group";
  const isGroup = active.startsWith("g:");
  const isFriend = !isLobby && !isGroup;
  const many = isLobby || isGroup; // chats with more than two people

  const title = isLobby
    ? "Lobby"
    : isGroup
      ? group?.name || "Group"
      : shown(active);
  const count = group?.member_count;
  const subtitle = isLobby
    ? "Open to everyone (temporary)"
    : isGroup
      ? count
        ? `${count} member${count === 1 ? "" : "s"}`
        : ""
      : typing
        ? "typing..."
        : `@${active} · ${peerOffline ? "offline" : "online"}`;

  return (
    <>
      <header className="top">
        <Avatar
          profile={isFriend ? profiles[active] : null}
          name={title}
          online={isFriend ? !peerOffline : undefined}
        />
        <div>
          <div className="title">{title}</div>
          <div className="sub" aria-live="polite">
            {subtitle}
          </div>
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
              {line.name !== name && many && (
                <span className="who">
                  {line.display_name || shown(line.name)}
                </span>
              )}
              <span>{line.text}</span>
              <span className="time">{line.time}</span>
            </li>
          ),
        )}
      </ul>
    </>
  );
}
