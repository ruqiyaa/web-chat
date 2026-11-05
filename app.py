import re
import sqlite3
import time

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from db import init_db, get_db
from werkzeug.security import generate_password_hash


app = Flask(__name__)
socketio = SocketIO(app)

users = {}

@app.route("/")
def home():
    return render_template("index.html")

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

    return jsonify({
        "message": "Account created successfully",
        "user": {
            "id": user_id,
            "username": username,
            "display_name": display_name
        }
    }), 201

@socketio.on("join")
def handle_join(name):
    name = str(name).strip()[:20] or "Guest"
    if name.lower() in [n.lower() for n in users.values()]:
        emit("join_error", f"The name {name} is taken. Try another.")
        return
    users[request.sid] = name
    socketio.emit("notice", f"{name} joined")
    socketio.emit("users", sorted(users.values()))


@socketio.on("message")
def handle_message(text):
    name = users.get(request.sid, "Guest")
    print("Received from", name, ":", text)
    socketio.emit("message", {"name": name, "text": text})

@socketio.on("disconnect")
def handle_disconnect(reason=None):
    name = users.pop(request.sid, None)
    if name:
        socketio.emit("notice", f"{name} left")
        socketio.emit("users", sorted(users.values()))

def find_sid(name):
    for sid, n in users.items():
        if n.lower() == name.lower():
            return sid
    return None

@socketio.on("private")
def handle_private(data):
    if not isinstance(data, dict):
        return
    sender = users.get(request.sid)
    if not sender:
        return
    target = str(data.get("to", "")).strip()
    text = str(data.get("text", "")).strip()[:2000]
    if not text:
        return
    target_sid = find_sid(target)
    if target_sid is None:
        emit("notice", f"{target} is not online")
        return
    if target_sid == request.sid:
        emit("notice", "You cannot message yourself")
        return
    payload = {"from": sender, "to": users[target_sid], "text": text}
    socketio.emit("private", payload, to=target_sid)
    emit("private", payload)

init_db()
if __name__ == "__main__":
    socketio.run(app, port=5001, debug=True)