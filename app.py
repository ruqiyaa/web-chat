from flask import Flask, render_template, request
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app)

users = {}

@app.route("/")
def home():
    return render_template("index.html")

@socketio.on("join")
def handle_join(name):
    name = str(name).strip()[:20] or "Guest"
    users[request.sid] = name
    socketio.emit("notice", f"{name} joined")


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

if __name__ == "__main__":
    socketio.run(app, port=5001, debug=True)