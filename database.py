"""
Maritime Fleet Defense & Risk-Aware Route Optimization System
---------------------------------------------------------------
SQLITE DATABASE AUTHENTICATION MODULE

Manages user credentials, role permissions, and account locking
in a persistent SQLite database file (`users.db`).
"""

import os
import sqlite3
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


def hash_password(password: str) -> str:
    """Computes SHA-256 hash of a password string."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def init_db(db_path: str = DB_PATH):
    """Initializes SQLite database schema and seeds default accounts if not present."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            is_locked INTEGER DEFAULT 0,
            failed_attempts INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Seed default user accounts if table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        default_users = [
            ("commander", hash_password("test123"), "Fleet Commander"),
            ("crew", hash_password("test123"), "Vessel Crew"),
            ("admin", hash_password("test123"), "System Administrator"),
        ]
        cursor.executemany(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            default_users
        )
        conn.commit()

    conn.close()


def authenticate_user_db(username: str, password_raw: str, db_path: str = DB_PATH):
    """
    Authenticates a user against the SQLite database.
    Increments failed attempts on failure; locks account if failed attempts >= 3.
    """
    user_key = username.lower().strip()
    pwd_hash = hash_password(password_raw)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, password_hash, role, is_locked, failed_attempts FROM users WHERE LOWER(username) = ?",
        (user_key,)
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        return {"success": False, "error": f"Unknown username '{username}'.", "locked": False}

    user_id, uname, stored_hash, role, is_locked, attempts = row

    if is_locked == 1:
        conn.close()
        return {"success": False, "error": "Account is locked due to repeated failed login attempts.", "locked": True}

    if stored_hash == pwd_hash:
        # Reset failed attempts
        cursor.execute("UPDATE users SET failed_attempts = 0 WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return {"success": True, "username": uname, "role": role, "locked": False}
    else:
        new_attempts = attempts + 1
        locked_state = 0
        if new_attempts >= 3:
            locked_state = 1

        cursor.execute(
            "UPDATE users SET failed_attempts = ?, is_locked = ? WHERE id = ?",
            (new_attempts, locked_state, user_id)
        )
        conn.commit()
        conn.close()

        if locked_state == 1:
            return {"success": False, "error": "Maximum login attempts exceeded. Account locked.", "locked": True}
        else:
            remaining = 3 - new_attempts
            return {"success": False, "error": f"Invalid password. {remaining} attempt(s) remaining.", "locked": False}


def unlock_account_db(username: str, db_path: str = DB_PATH):
    """Unlocks a user account in the SQLite database."""
    user_key = username.lower().strip()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("UPDATE users SET is_locked = 0, failed_attempts = 0 WHERE LOWER(username) = ?", (user_key,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_all_users_db(db_path: str = DB_PATH):
    """Returns status list of all accounts."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT username, role, is_locked, failed_attempts FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [{"username": r[0], "role": r[1], "is_locked": bool(r[2]), "failed_attempts": r[3]} for r in rows]


# Initialize database upon module import
init_db()
