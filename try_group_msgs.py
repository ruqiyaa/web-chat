from app import app, post_group_message, GroupError
from db import get_db


def make_client(username, password):
    c = app.test_client()
    c.post("/api/register", json={"username": username, "display_name": username, "password": password})
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    with c.session_transaction() as sess:
        sess["user_id"] = row["id"]
    return c, row


def show(label, res):
    print(f"{label}: {res.status_code} {res.get_json()}")


a, a_row = make_client("tester_a", "testpass_a1")
b, b_row = make_client("tester_b", "testpass_b1")
c, c_row = make_client("tester_c", "testpass_c1")

with get_db() as db:      # remove leftovers if an earlier run crashed half way
    db.execute("DELETE FROM chat_groups WHERE name = 'Try group'")

# friends, then a group of a and b (c stays outside)
a.post("/api/friends/request", json={"username": "tester_b"})
b.post("/api/friends/accept", json={"username": "tester_a"})
gid = a.post("/api/groups", json={"name": "Try group", "members": ["tester_b"]}).get_json()["group"]["id"]

print("--- sending (the function the socket handler uses)")
payload, who = post_group_message(b_row, gid, "  hello group  ")
print("1. b sends:", payload["text"], "| delivered to:", sorted(who))
post_group_message(b_row, gid, "second message")
post_group_message(a_row, gid, "a replies")
for label, user, text in [("2. c (not a member) sends", c_row, "let me in"),
                          ("3. b sends only spaces", b_row, "   ")]:
    try:
        post_group_message(user, gid, text)
    except GroupError as e:
        print(f"{label}: refused -> {e}")
payload, _ = post_group_message(b_row, gid, "x" * 5000)
print("4. a 5000-character message is saved with", len(payload["text"]), "characters")

print("--- reading")


def mine(client):
    return next(x for x in client.get("/api/groups").get_json()["groups"] if x["id"] == gid)


g = mine(a)
print("5. a's group list: unread =", g["unread"], "| last =", g["last"]["from"], ":", g["last"]["text"][:12])
print("6. b's own unread:", mine(b)["unread"], "(b read his own, a replied once)")
res = a.get(f"/api/groups/{gid}/messages")
print("7. history (oldest first):", [m["text"][:12] for m in res.get_json()["messages"]])
show("8. c reads the history (not a member)", c.get(f"/api/groups/{gid}/messages"))
show("9. a marks it read", a.post(f"/api/groups/{gid}/read"))
print("10. a's unread now:", mine(a)["unread"])
show("11. c marks read (not a member)", c.post(f"/api/groups/{gid}/read"))

with get_db() as db:
    db.execute("DELETE FROM chat_groups WHERE name = 'Try group'")
print("--- cleaned up")