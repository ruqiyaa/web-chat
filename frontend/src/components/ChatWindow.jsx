import { useEffect, useRef } from "react";
import Avatar from "./Avatar";

export default function ChatWindow({
  name,
  profiles,
  active,
  online,
  lines,
  peerOffline,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, active]);

  const shown = (u) => profiles[u]?.display_name || u;
  const isGroup = active === "group";
  const title = isGroup ? "Group chat" : shown(active);
  const subtitle = isGroup
    ? `${online.length} online`
    : `@${active} · ${peerOffline ? "offline" : "online"}`;

  return (
    <>
      <header className="top">
        <Avatar profile={isGroup ? null : profiles[active]} name={title} />
        <div>
          <div className="title">{title}</div>
          <div className="sub">{subtitle}</div>
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
                <span className="who">{shown(line.name)}</span>
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
