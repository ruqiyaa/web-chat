import re
import os
import secrets
import sqlite3
import time

from datetime import timedelta
from pathlib import Path
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room
from db import init_db, get_db
from werkzeug.security import generate_password_hash, check_password_hash


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
socketio = SocketIO(app)

#-----HOME-----#
@app.route("/")
def home():
    return render_template("index.html")

#-----REGISTER-----#
@app.route("/api/register", methods=["POST"])
def register():
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
def public_user(row):
    return{
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "bio": row["bio"],
        "avatar": row["avatar"],
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

    username = username.strip().lower()

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()

    stored_hash = row["password_hash"] if row else DUMMY_HASH
    password_ok = check_password_hash(stored_hash, password[:128])

    if not row or not password_ok:
        return jsonify({"error": "Username or password is incorrect"}), 401

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


#-----SOCKETS-----#
online = {}

#-----CONNECT-----#
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
        socketio.emit("notice", f"{name} joined")
    socketio.emit("users", sorted(set(online.values())))

#-----DISCONNECT-----#
@socketio.on("disconnect")
def handle_disconnect(reason=None):
    name = online.pop(request.sid, None)
    if name and name not in online.values():
        socketio.emit("notice", f"{name} left")
        socketio.emit("users", sorted(set(online.values())))


#-----GROUP MESSAGE-----#
@socketio.on("message")
def handle_message(text):
    name = online.get(request.sid)
    if name is None or not isinstance(text, str):
        return
    text = text.strip()[:2000]
    if not text:
        return
    socketio.emit("message", {"name": name, "text": text})
    

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
        emit("notice", "You can't text yourself")
        return
    if target not in online.values():
        emit("notice", f"{target} not available")
        return
    payload = {"from": sender, "to": target, "text": text}
    socketio.emit("private", payload, to=target)
    socketio.emit("private", payload, to=sender)


init_db()
if __name__ == "__main__":
    socketio.run(app, port=5001, debug=True)