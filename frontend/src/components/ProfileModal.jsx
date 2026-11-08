import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Avatar from "./Avatar";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function ProfileModal({
  user,
  onUserChange,
  onLogout,
  onClose,
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio || "");
  const [file, setFile] = useState(null); //picture chosen but not saved
  const [preview, setPreview] = useState(null); //local address just incase second thoughts
  const [removePic, setRemovePic] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  //preview add for chosen file
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(e) {
    const chosen = e.target.files[0];
    e.target.value = "";
    if (!chosen) return;
    if (!ALLOWED.includes(chosen.type))
      return setError("Use JPEG, PNG, WEBP formats only");
    if (chosen.size > 3 * 1024 * 1024) return setError("Pick image under 3MB");
    setError("");
    setFile(chosen);
    setRemovePic(false);
  }

  function removePicture() {
    setFile(null);
    setRemovePic(true);
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let latest = user;

      if (file) {
        const form = new FormData();
        form.append("avatar", file);
        const res = await api("/api/avatar", { method: "POST", form });
        if (!res.ok)
          return setError(res.data?.error || "Could not upload the picture");
        latest = res.data.user;
      } else if (removePic && user.avatar_url) {
        const res = await api("/api/avatar", { method: "DELETE" });
        if (!res.ok)
          return setError(res.data?.error || "Could not remove picture");
        latest = res.data.user;
      }

      if (displayName !== user.display_name || bio !== (user.bio || "")) {
        const res = await api("/api/profile", {
          method: "PATCH",
          body: { display_name: displayName, bio },
        });
        if (!res.ok) {
          onUserChange(latest);
          return setError(res.daya?.error || "Could not save profile");
        }
        latest = res.data.user;
      }
      onUserChange(latest);
      onClose();
    } catch {
      setError("Could not reach server");
    } finally {
      setBusy(false);
    }
  }

  const shownProfile = removePic
    ? null
    : preview
      ? { avatar_url: preview }
      : user;
  const hasPicture = !!preview || (!removePic && !!user.avatar_url);

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
          <Avatar
            profile={shownProfile}
            name={displayName || user.display_name}
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => fileRef.current.click()}
            >
              Change picture
            </button>
            {hasPicture && (
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={removePicture}
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
            {busy ? "Saving..." : "Save"}
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
