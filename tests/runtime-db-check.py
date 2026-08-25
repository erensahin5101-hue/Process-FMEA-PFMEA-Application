import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="TYANA Q-Flow SQLite runtime smoke check")
    parser.add_argument("database", type=Path)
    args = parser.parse_args()
    database = args.database.resolve(strict=True)
    # The acceptance check must not create WAL/SHM sidecars in the user's app
    # data directory. Run only after the desktop process has fully stopped.
    connection = sqlite3.connect(f"{database.as_uri()}?mode=ro&immutable=1", uri=True)
    try:
        result = {
            "quick_check": connection.execute("PRAGMA quick_check").fetchone()[0],
            "processes": connection.execute("SELECT COUNT(1) FROM processes").fetchone()[0],
            "projects": connection.execute("SELECT COUNT(1) FROM projects").fetchone()[0],
            "users": connection.execute("SELECT COUNT(1) FROM users").fetchone()[0],
            "active_admins": connection.execute(
                "SELECT COUNT(1) FROM users WHERE role='admin' AND status='active'"
            ).fetchone()[0],
            "audit_events": connection.execute("SELECT COUNT(1) FROM audit_events").fetchone()[0],
        }
    finally:
        connection.close()
    if result["quick_check"] != "ok" or result["processes"] < 1 or result["active_admins"] < 1:
        raise SystemExit(json.dumps(result, ensure_ascii=False))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
