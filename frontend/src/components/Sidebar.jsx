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
  typing,
  isFriend,
  onOpen,
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
        </span>
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
  me,
  profiles,
  friends,
  groups,
  requestCount,
  active,
  unread,
  online,
  chats,
  typingFrom,
  onOpen,
  onProfile,
  onFriends,
  onNewGroup,
}) {
  const shown = (u) => profiles[u]?.display_name || u;
  const groupName = (key) =>
    groups.find((g) => `g:${g.id}` === key)?.name || "Group";
  // keys: "g:12" = a group, otherwise a friend's username
  const keys = [
    ...groups.map((g) => `g:${g.id}`),
    ...friends.map((f) => f.username),
  ];

  const rows = keys
    .map((key) => {
      const isGroup = key.startsWith("g:");
      const last = lastMessage(chats[key] || []);
      const mine = last && last.name === name;
      let preview = "";
      if (last) {
        preview =
          isGroup || mine
            ? `${mine ? "You" : last.display_name || shown(last.name)}: ${last.text}`
            : last.text;
      }
      return {
        key,
        isFriend: !isGroup,
        label: isGroup ? groupName(key) : shown(key),
        profile: isGroup ? null : profiles[key],
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

      <button type="button" className="friends-row" onClick={onNewGroup}>
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        <span>New group</span>
      </button>

      {rows.length === 0 && (
        <p className="empty">
          No chats yet. Tap Friends to find people by username.
        </p>
      )}

      {rows.map((row) => (
        <Contact
          key={row.key}
          label={row.label}
          profile={row.profile}
          isFriend={row.isFriend}
          isActive={active === row.key}
          unread={unread[row.key] || 0}
          offline={row.isFriend && !online.includes(row.key)}
          typing={!!typingFrom[row.key]}
          preview={row.preview}
          time={row.time}
          onOpen={() => onOpen(row.key)}
        />
      ))}
    </nav>
  );
}
