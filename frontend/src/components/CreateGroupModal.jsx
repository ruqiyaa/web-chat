import { useEffect, useState } from "react";
import { api } from "../api";
import Avatar from "./Avatar";

export default function CreateGroupModal({ friends, onCreated, onClose }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState([]); // usernames of the chosen friends
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(username) {
    setPicked((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api("/api/groups", {
        method: "POST",
        body: { name, members: picked },
      });
      if (res.ok) await onCreated(res.data.group);
      else setError(res.data?.error || "Something went wrong");
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label="New group"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>New group</h2>

        <label className="field">
          <span>Group name</span>
          <input
            type="text"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <h3 className="sub-h">Add friends ({picked.length} selected)</h3>
        {friends.length === 0 ? (
          <p className="note">
            Add some friends first, then you can make a group.
          </p>
        ) : (
          <ul className="person-list">
            {friends.map((f) => (
              <li key={f.username}>
                <label className="pick">
                  <input
                    type="checkbox"
                    checked={picked.includes(f.username)}
                    onChange={() => toggle(f.username)}
                  />
                  <Avatar profile={f} name={f.display_name} />
                  <span className="person-text">
                    <span className="person-name">{f.display_name}</span>
                    <span className="person-user">@{f.username}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="btn-row">
          <button
            type="submit"
            className="btn solid"
            disabled={busy || !name.trim() || picked.length === 0}
          >
            {busy ? "Creating..." : "Create group"}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
