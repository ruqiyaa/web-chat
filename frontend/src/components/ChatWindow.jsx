import { useEffect, useRef } from "react";

export default function ChatWindow({
  name,
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

  const title = active === "group" ? "Group Chat" : active;
  const subtitle =
    active === "group"
      ? `${online.length} online: ${online.join(", ")}`
      : peerOffline
        ? "offline"
        : "online";

  return (
    <>
      <header className="top">
        <div className="avatar">{title[0].toUpperCase()}</div>
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
              {line.name !== name && active === "group" && (
                <span className="who">{line.name}</span>
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
