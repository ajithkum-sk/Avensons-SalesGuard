"""Bulk-create app_user logins for every salesman who doesn't have one yet.
Prints credentials to stdout and writes them to salesman_credentials.csv.
"""
import csv
import re
import secrets
import sys

sys.path.insert(0, ".")
import bcrypt
from app.db import execute, fetch_all, open_pool


def make_username(name: str, key: int) -> str:
    slug = re.sub(r"[^a-z0-9]", "", name.lower())[:20]
    return f"{slug}{key}"


def main():
    open_pool()
    salesmen = fetch_all("SELECT salesman_key, salesman_name FROM sg.dim_salesman ORDER BY salesman_key")
    existing = {r["salesman_key"] for r in fetch_all(
        "SELECT salesman_key FROM sg.app_user WHERE salesman_key IS NOT NULL"
    )}

    rows_created = []
    for s in salesmen:
        if s["salesman_key"] in existing:
            continue
        key, name = s["salesman_key"], s["salesman_name"]
        username = make_username(name, key)
        email = f"{username}@avensons.local"
        password = secrets.token_urlsafe(6)
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        execute(
            "INSERT INTO sg.app_user (username, full_name, role, salesman_key, is_active, email, password_hash) "
            "VALUES (%s, %s, 'salesman', %s, true, %s, %s)",
            [username, name, key, email, password_hash],
        )
        rows_created.append({"salesman_key": key, "name": name, "email": email, "password": password})

    with open("salesman_credentials.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["salesman_key", "name", "email", "password"])
        writer.writeheader()
        writer.writerows(rows_created)

    print(f"Created {len(rows_created)} salesman logins. Credentials written to salesman_credentials.csv")


if __name__ == "__main__":
    main()
