export default function Avatar({ profile, name }) {
  const initial = (name || profile?.display_name || "?")[0].toUpperCase();
  return (
    <span className="avatar">
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}
    </span>
  );
}
