import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import Avatar from "./Avatar";

export default function GroupInfoModal({
  groupId,
  groups,
  me,
  friends,
  onChanged,
  onLeft,
  onClose,
  initialDetail = null, // lets a test render the loaded screen straight away
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [nameDraft, setNameDraft] = useState(null); // null means "not editing the name"
  const [picked, setPicked] = useState([]); // friends ticked to be added
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api(`/api/groups/${groupId}`);
      if (res.ok) setDetail(res.data.group);
      else setError(res.data?.error || "Could not load the group");
    } catch {
      setError("Could not reach the server");
    }
  }, [groupId]);

  // Load on open, and again whenever the page reloads its list of groups. That
  // happens after every change, including changes made by other admins.
  useEffect(() => {
    load();
  }, [load, groups]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // One helper for every button: call the server, show any error, report success.
  async function act(path, options) {
    setError("");
    setBusy(true);
    try {
      const res = await api(path, options);
      if (!res.ok) {
        setError(res.data?.error || "Something went wrong");
        return false;
      }
      onChanged(); // the page reloads its groups, which reloads this too
      return true;
    } catch {
      setError("Could not reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/groups/${groupId}`;
  const isAdmin = detail?.my_role === "admin";
  const memberNames = detail ? detail.members.map((m) => m.username) : [];
  const addable = friends.filter((f) => !memberNames.includes(f.username));
  const shownName = nameDraft ?? detail?.name ?? "";

  async function rename(e) {
    e.preventDefault();
    const ok = await act(base, { method: "PATCH", body: { name: shownName } });
    if (ok) setNameDraft(null);
  }
  async function addPicked() {
    const ok = await act(`${base}/members`, {
      method: "POST",
      body: { usernames: picked },
    });
    if (ok) setPicked([]);
  }
  function remove(m) {
    if (window.confirm(`Remove ${m.display_name} from the group?`)) {
      act(`${base}/members/${encodeURIComponent(m.username)}`, {
        method: "DELETE",
      });
    }
  }
  function promote(m) {
    act(`${base}/admins`, { method: "POST", body: { username: m.username } });
  }
  async function leave() {
    if (
      !window.confirm("Leave this group? You will no longer see its messages.")
    )
      return;
    const ok = await act(`${base}/leave`, { method: "POST" });
    if (ok) onLeft();
  }
  function toggle(username) {
    setPicked((prev) =>
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username],
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label="Group info"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Group info</h2>

        {!detail ? (
          <p className="note">{error || "Loading..."}</p>
        ) : (
          <>
            {isAdmin ? (
              <form className="rename-row" onSubmit={rename}>
                <input
                  type="text"
                  value={shownName}
                  maxLength={40}
                  aria-label="Group name"
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn solid"
                  disabled={
                    busy ||
                    !shownName.trim() ||
                    shownName.trim() === detail.name
                  }
                >
                  Rename
                </button>
              </form>
            ) : (
              <p className="group-title">{detail.name}</p>
            )}

            <h3 className="sub-h">
              {detail.members.length} member
              {detail.members.length === 1 ? "" : "s"}
            </h3>
            <ul className="person-list">
              {detail.members.map((m) => (
                <li key={m.username} className="person">
                  <Avatar profile={m} name={m.display_name} />
                  <span className="person-text">
                    <span className="person-name">
                      {m.display_name}
                      {m.username === me ? " (you)" : ""}
                    </span>
                    <span className="person-user">@{m.username}</span>
                  </span>
                  <span className="person-actions">
                    {m.role === "admin" && (
                      <span className="role-tag">Admin</span>
                    )}
                    {isAdmin && m.username !== me && m.role === "member" && (
                      <>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => promote(m)}
                        >
                          Make admin
                        </button>
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy}
                          onClick={() => remove(m)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {isAdmin && (
              <>
                <h3 className="sub-h">Add friends</h3>
                {addable.length === 0 ? (
                  <p className="note">
                    All your friends are already in this group.
                  </p>
                ) : (
                  <>
                    <ul className="person-list">
                      {addable.map((f) => (
                        <li key={f.username}>
                          <label className="pick">
                            <input
                              type="checkbox"
                              checked={picked.includes(f.username)}
                              onChange={() => toggle(f.username)}
                            />
                            <Avatar profile={f} name={f.display_name} />
                            <span className="person-text">
                              <span className="person-name">
                                {f.display_name}
                              </span>
                              <span className="person-user">@{f.username}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="note">
                      New members only see messages sent after they join.
                    </p>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn solid"
                        disabled={busy || picked.length === 0}
                        onClick={addPicked}
                      >
                        Add {picked.length || ""} selected
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {error && detail && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="btn-row">
          {detail && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={leave}
            >
              Leave group
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
