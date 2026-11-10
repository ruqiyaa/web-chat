import re
import os
import secrets
import sqlite3
import time


from datetime import timedelta
from pathlib import Path
from flask import (Flask, render_template, request, jsonify, session, send_from_directory, abort)
from flask_socketio import SocketIO, emit, join_room
from db import init_db, get_db
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image, ImageOps, UnidentifiedImageError
from functools import wraps


app = Flask(__name__)

def load_secret_key():
    key = os.environ.get("RAABTA_SECRET_KEY")
    if key:
        return key
    path = Path(__file__).with_name(".dev_secret")
    if not path.exists():
        path.write_text(secrets.token_hex(32))
    return path.read_text().strip()

app.secret_key = load_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RAABTA_HTTPS") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)

app.config["MAX_CONTENT_LENGTH"] = 3 * 1024 * 1024 #rejecting uploads over 3mb
AVATAR_DIR = Path(__file__).with_name("uploads") / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
MAX_PIXELS = 20_000_000   #guards against img bombs

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large (max 3MB)"}), 413


socketio = SocketIO(app)


#----- rate limiting password (kept in memory) ----- #
from collections import deque
import threading

_hits = {}
_hits_lock = threading.Lock()

def _prune(key, window, now):
    q = _hits.get(key)
    if q is None:
        return 0
    while q and now - q[0] > window:  #forget events older than window
        q.popleft()
    if not q:
        del _hits[key]
        return 0
    return len(q)


def blocked(key, limit, window=600):
    with _hits_lock:
        return _prune(key, window, time.time()) >= limit

def hit(key):
    with _hits_lock:
        if len(_hits) > 10000:
            _hits.clear()
        _hits.setdefault(key, deque()).append(time.time())

def reset(key):
    with _hits_lock:
        _hits.pop(key, None)


#-----HOME-----#
@app.route("/")
def home():
    return render_template("index.html")

#-----REGISTER-----#
@app.route("/api/register", methods=["POST"])
def register():
    ip = request.remote_addr or "unknown"
    if blocked(("register", ip), 10, 3600):
        return jsonify({"error": "Too many sign-ups from this network. Try again later"}), 429
    
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    username = data.get("username")
    display_name = data.get("display_name")
    password = data.get("password")

    if not all(isinstance(value, str) for value in [username, display_name, password]):
        return jsonify({"error" : "All fields are required"}), 400

    username = username.strip().lower()
    display_name = display_name.strip()

    if not re.fullmatch(r"[a-zA-Z0-9_]{3,20}", username):
        return jsonify({"error": "Username must be 3-20 characters and contain only letters, numbers and underscores"}), 400

    if not display_name or len(display_name) > 30:
        return jsonify({"error": "Display name must be between 1 and 30 characters"}), 400

    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must contain atleast 8 and not more than 128 characters"}), 400

    with get_db() as db:
        existing_user = db.execute(
            "SELECT id FROM users WHERE username = ?", 
            (username,)
        ).fetchone()

        if existing_user:
            return jsonify({"error": "Username already exists"}), 409

        password_hash = generate_password_hash(password)

        try:
            cursor = db.execute(
                """
                INSERT INTO users (username, display_name, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (username, display_name, password_hash, int(time.time())),
            )

            user_id = cursor.lastrowid

        except sqlite3.IntegrityError as e:
            if "UNIQUE" in str(e):
                return jsonify({"error": "Username already exists"}), 409
            raise

    session.clear()
    session["user_id"] = user_id
    hit(("register", ip))

    return jsonify({
        "message": "Account created successfully",
        "user": {
            "id": user_id,
            "username": username,
            "display_name": display_name
        }
    }), 201

DUMMY_HASH = generate_password_hash("not-a-real-password")

#-----HELPER-----#
def profile_card(row):
    #what other people see about someone..no id no hash
    return {
        "username": row["username"],
        "display_name": row["display_name"],
        "bio": row["bio"],
        "avatar_url": f"/avatars/{row['avatar']}" if row["avatar"] else None,
    }

def public_user(row):
    return{
        "id": row["id"], **profile_card(row)
    }

#-----HELPER-----#
def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with get_db() as db:
        return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


#-----LOGIN-----#
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    username = data.get("username")
    password = data.get("password")
    remember = data.get("remember") is True
    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"error": "Username and password are required"}), 400

    username = username.strip().lower()[:30]
    ip = request.remote_addr or "unknown"
    pair = ("login", ip, username)

    #check limits
    if blocked(pair, 5) or blocked(("login-ip", ip), 20):
        return jsonify({"error": "Too many attempts. Try again after few minutes."}), 429

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()

    stored_hash = row["password_hash"] if row else DUMMY_HASH
    password_ok = check_password_hash(stored_hash, password[:128])

    if not row or not password_ok:
        hit(pair)
        hit(("login-ip", ip))
        return jsonify({"error": "Username or password is incorrect"}), 401

    reset(pair)
    session.clear()
    session["user_id"] = row["id"]
    session.permanent = remember
    return jsonify({"user": public_user(row)})


#-----LOGOUT-----#
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


#-----HOME PAGE-----#
@app.route("/api/me")
def me():
    user = current_user()
    if user is None:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify({"user": public_user(user)})

#----- PROFILE ------ #

@app.route("/api/profile", methods=["PATCH"])
def update_profile():
    user = current_user()
    if user is None:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400
    display_name = data.get("display_name")
    bio = data.get("bio", "")
    if not isinstance(display_name, str) or not isinstance(bio, str):
        return jsonify({"error": "Invalid request data"}), 400

    display_name = " ".join(display_name.split())
    bio = " ".join(bio.split())
    if not display_name or len(display_name) > 30:
        return jsonify({"error": "Enter valid name(1-30 characters)"}), 400
    if len(bio) > 160:
        return jsonify({"error": "Bio not more than 160 characters"}), 400

    with get_db() as db:
        db. execute("UPDATE users SET display_name = ?, bio = ? WHERE id = ?",
                    (display_name, bio, user["id"]))
    notify_profile_changed(user)
    return jsonify({"user": public_user(current_user())})


#----- AVATAR -----#
def delete_avatar_file(filename):
    if filename:
        (AVATAR_DIR / Path(filename).name).unlink(missing_ok=True)

@app.route("/api/avatar", methods=["POST"])
def upload_avatar():
    user = current_user()
    if user is None:
        return jsonify({"error": "Please log in"}), 401
    if blocked(("avatar", user["id"]), 10, 3600):
        return jsonify({"error": "Too many uploads. Try again later"}), 429
    file = request.files.get("avatar")
    if file is None:
        return jsonify({"error": "No file received"}), 400

    try:
        img = Image.open(file.stream)           #reads only header
        if img.format not in ("JPEG", "PNG", "WEBP"):
            return jsonify({"error": "Use only JPEG, PNG or WEBP format"}), 400
        if img.width * img.height > MAX_PIXELS:
            return jsonify({"error": "Image too large"}), 400
        img = ImageOps.exif_transpose(img)      #phone rotation
        img = img.convert("RGBA")
        flat = Image.new("RGB", img.size, "white")  #transparent ares become white
        flat.paste(img, mask=img.getchannel("A"))
        img = ImageOps.fit(flat, (256, 256))        #square crop 256*256

    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        return jsonify({"error": "Invalid image"}), 400

    filename = secrets.token_hex(16) + ".jpg"       #random name
    img.save(AVATAR_DIR / filename, "JPEG", quality=85)     #re-encoded: brand new file
    hit(("avatar", user["id"]))

    with get_db() as db:
        db.execute("UPDATE users SET avatar = ? WHERE id = ?", (filename, user["id"]))

    delete_avatar_file(user["avatar"])
    notify_profile_changed(user)
    return jsonify({"user": public_user(current_user())})

@app.route("/api/avatar", methods=["DELETE"])
def remove_avatar():
    user = current_user()
    if user is None:
        return jsonify({"error": "Not logged in"}), 401
    with get_db() as db:
        db.execute("UPDATE users SET avatar = NULL WHERE id = ?", (user["id"],))
    delete_avatar_file(user["avatar"])
    notify_profile_changed(user)
    return jsonify({"user": public_user(current_user())})


@app.route("/avatars/<filename>")
def avatar_file(filename):
    if current_user() is None:                            # only logged-in users see pictures
        abort(401)
    if not re.fullmatch(r"[0-9a-f]{32}\.jpg", filename):  # only names we generated
        abort(404)
    resp = send_from_directory(AVATAR_DIR, filename)
    resp.headers["Cache-Control"] = "private, max-age=86400"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


#----- FRIENDS -----#
def login_required(fn):
    #runs a route only for logged in users
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Not logged in"}), 401
        return fn(user, *args, **kwargs)
    return wrapper

def pair(x, y):
    return (x, y) if x < y else (y, x)

def get_friendship(db, me_id, other_id):
    a, b = pair(me_id, other_id)
    return db.execute(
        "SELECT * FROM friendships WHERE user_a = ? AND user_b = ?", (a, b)
    ).fetchone()

def find_user(db, username):
    if not isinstance(username, str):
        return None
    return db.execute(
        "SELECT * FROM users WHERE username = ?", (username.strip().lower(),)
    ).fetchone()

def relation(db, me_id, other_id):
    f = get_friendship(db, me_id, other_id)
    if f is None:
        return "none"
    if f["status"] == "accepted":
        return "friends"
    return "sent" if f["requested_by"] == me_id else "received"

def body_username():
    data = request.get_json(silent=True)
    return data.get("username") if isinstance(data, dict) else None

def notify_friends_changed(*usernames):
    for u in set(usernames):
        socketio.emit("friends_changed", to=u)

@app.route("/api/users/search")
@login_required
def search_users(user):
    if blocked(("search", user["id"]), 60, 60):
        return jsonify({"error": "Too many searched. Slow down"}), 429
    hit(("search", user["id"]))
    q = request.args.get("q", "").strip().lower()
    if not re.fullmatch(r"[a-z0-9_]{2,20}", q):
        return jsonify({"users": []})
    pattern = q.replace("_", "\\_") + "%"
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND id != ?"
            "ORDER BY username LIMIT 10",
            (pattern, user["id"]),
        ).fetchall()
        out = [{**profile_card(r), "relation": relation(db, user["id"], r["id"])}
               for r in rows]
    return jsonify({"users": out})


@app.route("/api/friends")
@login_required
def list_friends(user):
    with get_db() as db:
        rows = db.execute(
            """
            SELECT u.*, f.status, f.requested_by
            FROM friendships f
            JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            WHERE f.user_a = ? OR f.user_b = ?
            ORDER BY u.username
            """,
            (user["id"],) * 3,
        ).fetchall()
    out = {"friends": [], "incoming": [], "outgoing": []}
    for r in rows:
        card = profile_card(r)
        if r["status"] == "accepted":
            out["friends"].append(card)
        elif r["requested_by"] == user["id"]:
            out["outgoing"].append(card)
        else:
            out["incoming"].append(card)
    return jsonify(out)


@app.route("/api/friends/request", methods=["POST"])
@login_required
def friend_request(user):
    if blocked(("freq", user["id"]), 20, 3600):
        return jsonify({"error": "Too many requests. Try again later."}), 429
    with get_db() as db:
        target = find_user(db, body_username())
        if target is None:
            return jsonify({"error": "No user with that username"}), 404
        if target["id"] == user["id"]:
            return jsonify({"error": "You cannot add yourself"}), 400
        f = get_friendship(db, user["id"], target["id"])
        if f is not None:
            if f["status"] == "accepted":
                return jsonify({"error": "You are already friends"}), 409
            if f["requested_by"] == user["id"]:
                return jsonify({"error": "Request already sent"}), 409
            # they had already asked us, so adding them back means accepting
            db.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (f["id"],))
            result = "accepted"
        else:
            a, b = pair(user["id"], target["id"])
            try:
                db.execute(
                    "INSERT INTO friendships (user_a, user_b, requested_by, status, created_at) "
                    "VALUES (?, ?, ?, 'pending', ?)",
                    (a, b, user["id"], int(time.time())),
                )
            except sqlite3.IntegrityError:
                return jsonify({"error": "Request already sent"}), 409
            result = "sent"
    hit(("freq", user["id"]))
    notify_friends_changed(user["username"], target["username"])
    return jsonify({"result": result}), 201


@app.route("/api/friends/accept", methods=["POST"])
@login_required
def friend_accept(user):
    with get_db() as db:
        target = find_user(db, body_username())
        f = get_friendship(db, user["id"], target["id"]) if target else None
        # only the person who was ASKED can accept (the other one made the request)
        if f is None or f["status"] != "pending" or f["requested_by"] != target["id"]:
            return jsonify({"error": "No pending request from that user"}), 404
        db.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (f["id"],))
    notify_friends_changed(user["username"], target["username"])
    return jsonify({"result": "accepted"})


@app.route("/api/friends/reject", methods=["POST"])
@login_required
def friend_reject(user):
    with get_db() as db:
        target = find_user(db, body_username())
        f = get_friendship(db, user["id"], target["id"]) if target else None
        if f is None or f["status"] != "pending" or f["requested_by"] != target["id"]:
            return jsonify({"error": "No pending request from that user"}), 404
        db.execute("DELETE FROM friendships WHERE id = ?", (f["id"],))
    notify_friends_changed(user["username"], target["username"])
    return jsonify({"result": "rejected"})


@app.route("/api/friends/<username>", methods=["DELETE"])
@login_required
def friend_remove(user, username):
    # Removes a friend, or cancels a request I sent. You cannot delete someone
    # else's request to you this way (that is "reject").
    with get_db() as db:
        target = find_user(db, username)
        f = get_friendship(db, user["id"], target["id"]) if target else None
        allowed = f is not None and (f["status"] == "accepted" or f["requested_by"] == user["id"])
        if not allowed:
            return jsonify({"error": "Nothing to remove"}), 404
        db.execute("DELETE FROM friendships WHERE id = ?", (f["id"],))
    notify_friends_changed(user["username"], target["username"])
    return jsonify({"result": "removed"})



#----- MESSAGES -----#
def friend_map(db, user_id):
    rows = db.execute(
        """
        SELECT u.id, u.username FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
        WHERE (f.user_a = ? OR f.user_b = ?) AND f.status = 'accepted'
        """,
        (user_id,) * 3,
    ).fetchall()
    return {r["id"]: r["username"] for r in rows}

def msg_json(row, names):
    return {
        "id": row["id"],
        "from": names[row["sender_id"]],
        "to": names[row["recipient_id"]],
        "text": row["body"],
        "ts": row["created_at"],
    }


def too_fast(name):
    # at most 30 messages per 10 seconds per person
    if blocked(("msg", name), 30, 10):
        return True
    hit(("msg", name))
    return False


@app.route("/api/conversations")
@login_required
def conversations(user):
    # For the sidebar: each friend's last message and unread count.
    with get_db() as db:
        friends = friend_map(db, user["id"])
        names = {user["id"]: user["username"], **friends}
        unread_rows = db.execute(
            "SELECT sender_id, COUNT(*) AS n FROM messages "
            "WHERE recipient_id = ? AND read_at IS NULL GROUP BY sender_id",
            (user["id"],),
        ).fetchall()
        last_rows = db.execute(
            """
            SELECT * FROM messages WHERE id IN (
                SELECT MAX(id) FROM messages
                WHERE sender_id = ? OR recipient_id = ?
                GROUP BY CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
            )
            """,
            (user["id"],) * 3,
        ).fetchall()
    out = {name: {"unread": 0, "last": None} for name in friends.values()}
    for r in unread_rows:
        if r["sender_id"] in friends:
            out[friends[r["sender_id"]]]["unread"] = r["n"]
    for r in last_rows:
        partner = r["recipient_id"] if r["sender_id"] == user["id"] else r["sender_id"]
        if partner in friends:
            out[friends[partner]]["last"] = msg_json(r, names)
    return jsonify({"conversations": out})


@app.route("/api/messages/<username>")
@login_required
def message_history(user, username):
    before = request.args.get("before", type=int)        # for "load earlier" later
    with get_db() as db:
        other = find_user(db, username)
        f = get_friendship(db, user["id"], other["id"]) if other else None
        if f is None or f["status"] != "accepted":
            return jsonify({"error": "Not a friend"}), 404
        sql = ("SELECT * FROM messages WHERE ((sender_id = ? AND recipient_id = ?) "
               "OR (sender_id = ? AND recipient_id = ?))")
        args = [user["id"], other["id"], other["id"], user["id"]]
        if before:
            sql += " AND id < ?"
            args.append(before)
        sql += " ORDER BY id DESC LIMIT 101"
        rows = db.execute(sql, args).fetchall()
    has_more = len(rows) > 100
    rows = rows[:100][::-1]                               # oldest first
    names = {user["id"]: user["username"], other["id"]: other["username"]}
    return jsonify({"messages": [msg_json(r, names) for r in rows], "has_more": has_more})


@app.route("/api/messages/<username>/read", methods=["POST"])
@login_required
def mark_read(user, username):
    with get_db() as db:
        other = find_user(db, username)
        if other is None:
            return jsonify({"error": "Not found"}), 404
        db.execute(
            "UPDATE messages SET read_at = ? "
            "WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
            (int(time.time() * 1000), user["id"], other["id"]),
        )
    return jsonify({"result": "ok"})
        

#-----SOCKETS-----#
online = {}

def friend_usernames(user_id):
    with get_db() as db:
        rows = db.execute(
            """
            SELECT u.username FROM friendships f
            JOIN users u ON u.id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            WHERE (f.user_a = ? OR f.user_b = ?) AND f.status = 'accepted'
            """,
            (user_id,) * 3,
        ).fetchall()
    return [r["username"] for r in rows]


def notify_profile_changed(user): #reload list
    notify_friends_changed(user["username"], *friend_usernames(user["id"]))


def broadcast_presence(name, is_online):
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE username = ?", (name,)).fetchone()
    if row is None:
        return
    for friend in friend_usernames(row["id"]):
        socketio.emit("presence", {"username": name, "online": is_online}, to=friend)


@socketio.on("connect")
def handle_connect(auth=None):
    user = current_user()
    if user is None:
        return False
    name = user["username"]
    first_tab = name not in online.values()
    online[request.sid] = name
    join_room(name)
    if first_tab:
        socketio.emit("notice", f"{name} joined")      # lobby feed
        broadcast_presence(name, True)


@socketio.on("disconnect")
def handle_disconnect(reason=None):
    name = online.pop(request.sid, None)
    if name and name not in online.values():           # that was their last tab
        socketio.emit("notice", f"{name} left")
        broadcast_presence(name, False)


@socketio.on("presence_request")
def handle_presence_request():
    # "Which of my friends are online right now?" Answered to the asker only.
    name = online.get(request.sid)
    if name is None:
        return
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE username = ?", (name,)).fetchone()
    friends = friend_usernames(row["id"]) if row else []
    now_online = set(online.values())
    emit("presence_list", [f for f in friends if f in now_online])


@socketio.on("message")
def handle_message(text):
    # The Lobby: open to every logged-in user (temporary, not stored)
    name = online.get(request.sid)
    if name is None or not isinstance(text, str):
        return
    text = text.strip()[:2000]
    if not text:
        return
    if too_fast(name):
        emit("problem", "You are sending messages too fast")
        return
    with get_db() as db:
        row = db.execute("SELECT display_name FROM users WHERE username = ?", (name,)).fetchone()
    socketio.emit("message", {
        "name": name,
        "display_name": row["display_name"] if row else name,
        "text": text,
    })


@socketio.on("private")
def handle_private(data):
    sender = online.get(request.sid)
    if sender is None or not isinstance(data, dict):
        return
    target = str(data.get("to", "")).strip().lower()
    text = str(data.get("text", "")).strip()[:2000]
    if not text:
        return
    if target == sender:
        emit("problem", "You can't text yourself")
        return
    if too_fast(sender):
        emit("problem", "You are sending messages too fast")
        return
    with get_db() as db:
        me = find_user(db, sender)
        other = find_user(db, target)
        f = get_friendship(db, me["id"], other["id"]) if me and other else None
        if f is None or f["status"] != "accepted":        # the server enforces this rule
            emit("problem", "You can only message friends")
            return
        now = int(time.time() * 1000)                     # the SERVER decides the time
        cur = db.execute(
            "INSERT INTO messages (sender_id, recipient_id, body, created_at) "
            "VALUES (?, ?, ?, ?)",
            (me["id"], other["id"], text, now),
        )
        msg_id = cur.lastrowid
    payload = {"id": msg_id, "from": sender, "to": target, "text": text, "ts": now}
    socketio.emit("private", payload, to=target)          # no-op if they are offline
    socketio.emit("private", payload, to=sender)          # all of the sender's tabs


@socketio.on("typing")
def handle_typing(data):
    sender = online.get(request.sid)
    if sender is None or not isinstance(data, dict):
        return
    target = str(data.get("to", "")).strip().lower()
    if target == sender or blocked(("typing", sender), 12, 10):
        return
    hit(("typing", sender))
    with get_db() as db:
        me = find_user(db, sender)
        other = find_user(db, target)
        f = get_friendship(db, me["id"], other["id"]) if me and other else None
    if f is None or f["status"] != "accepted":
        return
    socketio.emit("typing", {"from": sender, "typing": data.get("typing") is True}, to=target)

init_db()
if __name__ == "__main__":
    socketio.run(app, port=5001, debug=True)