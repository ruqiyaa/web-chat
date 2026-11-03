function lastMessage(lines = []) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].kind === "message") return lines[i];
  }
  return null;
}

function Contact({ label, isActive, unread, offline, preview, time, onOpen }) {
  return (
    <button
      type="button"
      className={isActive ? "contact active" : "contact"}
      aria-current={isActive ? "true" : undefined}
      onClick={onOpen}
    >
      <span className="avatar">{label[0].toUpperCase()}</span>
      <span className="contact-body">
        <span className="contact-top">
          <span className="contact-name">{label}</span>
          {offline && <span className="contact-state">offline</span>}
        </span>
        <span className="contact-preview">{preview || "No messages yet"}</span>
      </span>
      <span className="contact-meta">
        {time && <span className="contact-time">{time}</span>}
        {unread > 0 && (
          <span className="badge" aria-label={`${unread} unread`}>
            {unread}
          </span>
        )}
      </span>
    </button>
  );
}

export default function Sidebar({
  name,
  active,
  unread,
  online,
  chats,
  onOpen,
}) {
  const others = online.filter((n) => n !== name);
  const offlineWithChats = Object.keys(chats).filter(
    (k) => k !== "group" && !online.includes(k),
  );
  const keys = ["group", ...others, ...offlineWithChats];

  const rows = keys
    .map((key) => {
      const last = lastMessage(chats[key]);
      const mine = last && last.name === name;
      let preview = "";
      if (last) {
        preview =
          key === "group" || mine
            ? `${mine ? "You" : last.name}: ${last.text}`
            : last.text;
      }
      return {
        key,
        label: key === "group" ? "Group chat" : key,
        ts: last ? last.ts : 0,
        time: last ? last.time : "",
        preview,
      };
    })
    .sort((a, b) => b.ts - a.ts);

  return (
    <nav className="side" aria-label="Chats">
      <div className="me">Signed in as {name}</div>
      {rows.map((row) => (
        <Contact
          key={row.key}
          label={row.label}
          isActive={active === row.key}
          unread={unread[row.key] || 0}
          offline={row.key !== "group" && !online.includes(row.key)}
          preview={row.preview}
          time={row.time}
          onOpen={() => onOpen(row.key)}
        />
      ))}
    </nav>
  );
}
