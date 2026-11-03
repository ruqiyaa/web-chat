from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app)

users = {}

@app.route("/")
def home():
    return render_template("index.html")

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


if __name__ == "__main__":
    socketio.run(app, port=5001, debug=True)