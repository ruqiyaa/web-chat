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