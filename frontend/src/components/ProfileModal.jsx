import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Avatar from "./Avatar";

export default function ProfileModal({
  user,
  onUserChange,
  onLogout,
  onClose,
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(job) {
    setError("");
    setBusy(true);
    try {
      const res = await job();
      if (res.ok) onUserChange(res.data.user);
      else setError(res.data?.error || "Something went wrong");
      return res.ok;
    } catch {
      setError("Could not reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const ok = await run(() =>
      api("/api/profile", {
        method: "PATCH",
        body: { display_name: displayName, bio },
      }),
    );
    if (ok) onClose();
  }

  async function pickFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // lets you pick the same file again later
    if (!file) return;
    if (file.size > 3 * 1024 * 1024)
      return setError("Pick an image under 3 MB");
    const form = new FormData();
    form.append("avatar", file);
    await run(() => api("/api/avatar", { method: "POST", form }));
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Your profile"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <h2>Your profile</h2>

        <div className="modal-avatar">
          <Avatar profile={user} name={user.display_name} />
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => fileRef.current.click()}
            >
              Change picture
            </button>
            {user.avatar_url && (
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={() =>
                  run(() => api("/api/avatar", { method: "DELETE" }))
                }
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={pickFile}
          />
        </div>

        <label className="field">
          <span>Username</span>
          <input type="text" value={"@" + user.username} disabled />
        </label>
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={displayName}
            maxLength={30}
            required
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Bio</span>
          <textarea
            value={bio}
            maxLength={160}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="hint">{bio.length}/160</p>
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="btn-row">
          <button type="submit" className="btn solid" disabled={busy}>
            Save
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn danger" onClick={onLogout}>
            Log out
          </button>
        </div>
      </form>
    </div>
  );
}
