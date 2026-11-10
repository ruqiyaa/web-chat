export default function Avatar({ profile, name, online }) {
  const initial = (name || profile?.display_name || "?")[0].toUpperCase();
  const circle = (
    <span className="avatar">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
    </span>
  );
  if (online === undefined) return circle;
  return (
    <span className="avatar-wrap">
      {circle}
      {online && <span className="dot" aria-hidden="true" />}
    </span>
  );
}
