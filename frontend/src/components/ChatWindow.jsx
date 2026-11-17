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
  onGroupInfo,
}) {
  const listRef = useRef(null);

  // Scroll to the bottom when a new message arrives or history finishes loading.
  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastLine, active, ready]);

  const shown = (u) => profiles[u]?.display_name || u;
  const isGroup = active.startsWith("g:");

  const title = isGroup ? group?.name || "Group" : shown(active);
  const count = group?.member_count;
  const subtitle = isGroup
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
        {isGroup && group && (
          <button type="button" className="hdr-btn" onClick={onGroupInfo}>
            Group info
          </button>
        )}
      </header>

      <ul className="messages" ref={listRef}>
        {lines.map((line, i) => (
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
        ))}
      </ul>
    </>
  );
}
