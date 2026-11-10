import { useEffect, useRef } from "react";
import Avatar from "./Avatar";

export default function ChatWindow({
  name,
  profiles,
  active,
  online,
  lines,
  peerOffline,
  ready,
  typing,
}) {
  const listRef = useRef(null);

  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastLine, active, ready]);

  const shown = (u) => profiles[u]?.display_name || u;
  const isGroup = active === "group";
  const title = isGroup ? "Lobby" : shown(active);
  const subtitle = isGroup
    ? "Open to everyone (temporary)"
    : typing
      ? "typing..."
      : `@${active} · ${peerOffline ? "offline" : "online"}`;

  return (
    <>
      <header className="top">
        <Avatar
          profile={isGroup ? null : profiles[active]}
          name={title}
          online={isGroup ? undefined : !peerOffline}
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
              {line.name !== name && isGroup && (
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
