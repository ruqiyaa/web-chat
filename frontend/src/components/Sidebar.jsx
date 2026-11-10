import logo from "../assets/raabta-logo.png";
import Avatar from "./Avatar";

function lastMessage(lines = []) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].kind === "message") return lines[i];
  }
  return null;
}

function Contact({
  label,
  profile,
  isActive,
  unread,
  offline,
  preview,
  time,
  count,
  onOpen,
  typing,
  isFriend,
}) {
  return (
    <button
      type="button"
      className={isActive ? "contact active" : "contact"}
      aria-current={isActive ? "true" : undefined}
      onClick={onOpen}
    >
      <Avatar
        profile={profile}
        name={label}
        online={isFriend ? !offline : undefined}
      />
      <span className="contact-body">
        <span className="contact-top">
          <span className="contact-name">{label}</span>
          {offline && <span className="contact-state">offline</span>}
        </span>
        <span className={typing ? "contact-preview typing" : "contact-preview"}>
          {typing ? "typing..." : preview || "No messages yet"}
        </span>{" "}
      </span>
      <span className="contact-meta">
        {time && <span className="contact-time">{time}</span>}
        {count > 0 && (
          <span className="contact-count">
            {count} msg{count === 1 ? "" : "s"}
          </span>
        )}
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
  me,
  profiles,
  friends,
  requestCount,
  active,
  unread,
  online,
  chats,
  onOpen,
  onProfile,
  onFriends,
  typingFrom,
}) {
  const keys = ["group", ...friends.map((f) => f.username)];
  const shown = (u) => profiles[u]?.display_name || u;

  const rows = keys
    .map((key) => {
      const lines = chats[key] || [];
      const last = lastMessage(lines);
      const mine = last && last.name === name;
      let preview = "";
      if (last) {
        preview =
          key === "group" || mine
            ? `${mine ? "You" : last.display_name || shown(last.name)}: ${last.text}`
            : last.text;
      }
      return {
        key,
        count: lines.filter((l) => l.kind === "message").length,
        label: key === "group" ? "Lobby" : shown(key),
        profile: key === "group" ? null : profiles[key],
        ts: last ? last.ts : 0,
        time: last ? last.time : "",
        preview,
      };
    })
    .sort((a, b) => b.ts - a.ts);

  return (
    <nav className="side" aria-label="Chats">
      <div className="side-brand">
        <img src={logo} alt="" className="side-logo" />
        <span className="side-wordmark">Raabta</span>
      </div>

      <button type="button" className="me-row" onClick={onProfile}>
        <Avatar profile={me} name={me.display_name} />
        <span className="me-text">
          <span className="me-name">{me.display_name}</span>
          <span className="me-user">@{name} · Edit profile</span>
        </span>
      </button>

      <button type="button" className="friends-row" onClick={onFriends}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
        <span>Friends</span>
        {requestCount > 0 && (
          <span
            className="badge"
            aria-label={`${requestCount} friend requests`}
          >
            {requestCount}
          </span>
        )}
      </button>

      {friends.length === 0 && (
        <p className="empty">
          No friends yet. Tap Friends to find people by username.
        </p>
      )}

      {rows.map((row) => (
        <Contact
          key={row.key}
          label={row.label}
          profile={row.profile}
          isActive={active === row.key}
          unread={unread[row.key] || 0}
          offline={row.key !== "group" && !online.includes(row.key)}
          preview={row.preview}
          time={row.time}
          count={row.count}
          onOpen={() => onOpen(row.key)}
          typing={!!typingFrom[row.key]}
          isFriend={row.key != "group"}
        />
      ))}
    </nav>
  );
}
