from app import app, post_group_message
from db import get_db


def make_client(username, password):
    c = app.test_client()
    c.post("/api/register", json={"username": username,
           "display_name": username, "password": password})
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    with c.session_transaction() as sess:
        sess["user_id"] = row["id"]
    return c, row


def show(label, res):
    print(f"{label}: {res.status_code} {res.get_json()}")


a, a_row = make_client("tester_a", "testpass_a1")
b, b_row = make_client("tester_b", "testpass_b1")
c, c_row = make_client("tester_c", "testpass_c1")
d, d_row = make_client("tester_d", "testpass_d1")

with get_db() as db:      # remove leftovers if an earlier run crashed half way
    db.execute(
        "DELETE FROM chat_groups WHERE name IN ('Try group', 'Renamed group')")

# a is friends with b and d. c is a stranger.
a.post("/api/friends/request", json={"username": "tester_b"})
b.post("/api/friends/accept", json={"username": "tester_a"})
a.post("/api/friends/request", json={"username": "tester_d"})
d.post("/api/friends/accept", json={"username": "tester_a"})

gid = a.post("/api/groups", json={"name": "Try group",
             "members": ["tester_b"]}).get_json()["group"]["id"]
post_group_message(a_row, gid, "message before d joined")
post_group_message(b_row, gid, "another before d joined")


def mine(client):
    return next((x for x in client.get("/api/groups").get_json()["groups"] if x["id"] == gid), None)


def texts(client):
    res = client.get(f"/api/groups/{gid}/messages")
    return [m["text"][:14] for m in res.get_json()["messages"]] if res.status_code == 200 else res.status_code


print("--- who may rename")
show("1. b (member, not admin) renames", b.patch(
    f"/api/groups/{gid}", json={"name": "Hacked"}))
show("2. c (outsider) renames", c.patch(
    f"/api/groups/{gid}", json={"name": "Hacked"}))
show("3. a (admin) renames to empty", a.patch(
    f"/api/groups/{gid}", json={"name": "  "}))
show("4. a (admin) renames", a.patch(
    f"/api/groups/{gid}", json={"name": "Renamed group"}))

print("--- adding people")
show("5. b (not admin) adds d", b.post(
    f"/api/groups/{gid}/members", json={"usernames": ["tester_d"]}))
show("6. a adds stranger c", a.post(
    f"/api/groups/{gid}/members", json={"usernames": ["tester_c"]}))
show("7. a adds b again", a.post(
    f"/api/groups/{gid}/members", json={"usernames": ["tester_b"]}))
show("8. a adds friend d", a.post(
    f"/api/groups/{gid}/members", json={"usernames": ["tester_d"]}))

print("--- history privacy")
post_group_message(a_row, gid, "message after d joined")
print("9. what b sees:", texts(b))
print("10. what d sees:", texts(d))
print("11. d's unread:", mine(d)["unread"],
      "| d's last:", mine(d)["last"]["text"][:14])

print("--- removing and promoting")
show("12. d (member) removes b", d.delete(
    f"/api/groups/{gid}/members/tester_b"))
show("13. a removes d", a.delete(f"/api/groups/{gid}/members/tester_d"))
print("14. d's group list afterwards:", mine(d))
show("15. a promotes b to admin", a.post(
    f"/api/groups/{gid}/admins", json={"username": "tester_b"}))
show("16. a removes admin b", a.delete(f"/api/groups/{gid}/members/tester_b"))
show("17. a removes herself with the remove route",
     a.delete(f"/api/groups/{gid}/members/tester_a"))

print("--- leaving")
show("18. a adds d back", a.post(
    f"/api/groups/{gid}/members", json={"usernames": ["tester_d"]}))
print("19. d now sees:", texts(d),
      "(removed and re-added: old messages stay hidden)")
show("20. a (one of two admins) leaves", a.post(f"/api/groups/{gid}/leave"))
roles = {m["username"]: m["role"]
         for m in b.get(f"/api/groups/{gid}").get_json()["group"]["members"]}
print("21. roles now:", roles)
show("22. b (the only admin) leaves", b.post(f"/api/groups/{gid}/leave"))
roles = {m["username"]: m["role"]
         for m in d.get(f"/api/groups/{gid}").get_json()["group"]["members"]}
print("23. roles after b left:", roles, "<- someone must be in charge")
show("24. d (the last one) leaves", d.post(f"/api/groups/{gid}/leave"))
show("25. the group is gone", d.get(f"/api/groups/{gid}"))
with get_db() as db:
    n = db.execute(
        "SELECT COUNT(*) AS n FROM group_messages WHERE group_id = ?", (gid,)).fetchone()["n"]
print("26. messages left over from the deleted group:", n)

with get_db() as db:      # tidy up: groups, and the friendship with d (a-b stays)
    db.execute(
        "DELETE FROM chat_groups WHERE name IN ('Try group', 'Renamed group')")
    db.execute("DELETE FROM friendships WHERE user_a = ? OR user_b = ?",
               (d_row["id"], d_row["id"]))
print("--- cleaned up")
