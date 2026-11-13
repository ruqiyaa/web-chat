import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).with_name("raabta.db")


@contextmanager
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY,
                username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name    TEXT NOT NULL,
                password_hash   TEXT NOT NULL,
                bio             TEXT NOT NULL DEFAULT '',
                avatar          TEXT,
                created_at      INTEGER NOT NULL
                )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS friendships (
            id              INTEGER PRIMARY KEY,
            user_a          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_b          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            requested_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status          TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
            created_at      INTEGER NOT NULL,
            CHECK (user_a < user_b),
            CHECK (requested_by IN (user_a, user_b)),
            UNIQUE (user_a, user_b)
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_friend_b ON friendships (user_b)")

        db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
            id              INTEGER PRIMARY KEY,
            sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
            created_at      INTEGER NOT NULL, --milliseconds, stamped by server
            read_at         INTEGER,        --null means not read yet
            CHECK (sender_id != recipient_id)
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages (sender_id, recipient_id, id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_msg_unread ON messages (recipient_id, read_at)")

        db.execute("""
            CREATE TABLE IF NOT EXISTS chat_groups (
                id              INTEGER PRIMARY KEY,
                name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
                created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at      INTEGER NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS group_members (
                group_id        INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
                last_read_id    INTEGER NOT NULL DEFAULT 0,
                joined_at       INTEGER NOT NULL,
                PRIMARY KEY (group_id, user_id)
            )
        """
        )
        db.execute("CREATE INDEX IF NOT EXISTS idx_members_user ON group_members (user_id)")
        db.execute("""
            CREATE TABLE IF NOT EXISTS group_messages (
                id          INTEGER PRIMARY KEY,
                group_id    INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
                created_at  INTEGER NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_gmsg_group ON group_messages (group_id, id)")