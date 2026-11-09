import { useEffect, useState } from "react";
import { api } from "../api";
import Avatar from "./Avatar";

function Person({ p, children }) {
  return (
    <li className="person">
      <Avatar profile={p} name={p.display_name} />
      <span className="person-text">
        <span className="person-name">{p.display_name}</span>
        <span className="person-user">@{p.username}</span>
      </span>
      <span className="person-actions">{children}</span>
    </li>
  );
}

export default function FriendsModal({ data, onChanged, onClose }) {
  const [tab, setTab] = useState(data.incoming.length ? "requests" : "find");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Search as you type, after a short pause. "stale" ignores answers that arrive late.
  useEffect(() => {
    if (tab !== "find" || q.length < 2) {
      setResults([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (stale) return;
        if (res.ok) {
          setResults(res.data.users);
          setError("");
        } else {
          setError(res.data?.error || "Search failed");
        }
      } catch {
        if (!stale) setError("Could not reach the server");
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, tab, refresh]);

  async function act(path, options) {
    setError("");
    setBusy(true);
    try {
      const res = await api(path, options);
      if (!res.ok) setError(res.data?.error || "Something went wrong");
      await onChanged(); // reload the friends lists
      setRefresh((n) => n + 1); // and redo the search so buttons update
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }
  const post = (path, username) =>
    act(path, { method: "POST", body: { username } });
  const del = (username) =>
    act(`/api/friends/${encodeURIComponent(username)}`, { method: "DELETE" });
  const removeFriend = (p) => {
    if (window.confirm(`Remove ${p.display_name} from your friends?`))
      del(p.username);
  };

  function searchAction(p) {
    switch (p.relation) {
      case "friends":
        return <span className="note">Friends</span>;
      case "sent":
        return (
          <>
            <span className="note">Requested</span>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => del(p.username)}
            >
              Cancel
            </button>
          </>
        );
      case "received":
        return (
          <button
            type="button"
            className="btn solid"
            disabled={busy}
            onClick={() => post("/api/friends/accept", p.username)}
          >
            Accept
          </button>
        );
      default:
        return (
          <button
            type="button"
            className="btn solid"
            disabled={busy}
            onClick={() => post("/api/friends/request", p.username)}
          >
            Add
          </button>
        );
    }
  }

  const tabs = [
    ["find", "Find people"],
    ["requests", "Requests"],
    ["friends", "Friends"],
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label="Friends"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Friends</h2>

        <div className="tabs" role="group" aria-label="Friends sections">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "tab on" : "tab"}
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
            >
              {label}
              {id === "requests" && data.incoming.length > 0 && (
                <span className="badge">{data.incoming.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "find" && (
          <>
            <input
              type="text"
              value={query}
              maxLength={20}
              autoFocus
              placeholder="Search by username"
              aria-label="Search by username"
              onChange={(e) => setQuery(e.target.value)}
            />
            {q.length < 2 ? (
              <p className="note">Type at least 2 letters of a username.</p>
            ) : results.length === 0 ? (
              <p className="note">No one found.</p>
            ) : (
              <ul className="person-list">
                {results.map((p) => (
                  <Person key={p.username} p={p}>
                    {searchAction(p)}
                  </Person>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            {data.incoming.length === 0 && data.outgoing.length === 0 && (
              <p className="note">No pending requests.</p>
            )}
            {data.incoming.length > 0 && (
              <>
                <h3 className="sub-h">Wants to be your friend</h3>
                <ul className="person-list">
                  {data.incoming.map((p) => (
                    <Person key={p.username} p={p}>
                      <button
                        type="button"
                        className="btn solid"
                        disabled={busy}
                        onClick={() => post("/api/friends/accept", p.username)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={busy}
                        onClick={() => post("/api/friends/reject", p.username)}
                      >
                        Reject
                      </button>
                    </Person>
                  ))}
                </ul>
              </>
            )}
            {data.outgoing.length > 0 && (
              <>
                <h3 className="sub-h">Waiting for a reply</h3>
                <ul className="person-list">
                  {data.outgoing.map((p) => (
                    <Person key={p.username} p={p}>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => del(p.username)}
                      >
                        Cancel
                      </button>
                    </Person>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === "friends" &&
          (data.friends.length === 0 ? (
            <p className="note">
              You have no friends yet. Use Find people to add some.
            </p>
          ) : (
            <ul className="person-list">
              {data.friends.map((p) => (
                <Person key={p.username} p={p}>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => removeFriend(p)}
                  >
                    Remove
                  </button>
                </Person>
              ))}
            </ul>
          ))}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="btn-row">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
