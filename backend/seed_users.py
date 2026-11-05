"""Create the three user accounts (one per role). Run once from the `backend` folder:

    python seed_users.py

Passwords are typed in by you (not stored in the code). Run again to reset a password.
"""
from getpass import getpass

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Role, User
from app.security import hash_password

USERS = [
    ("analyst", "Lab Analyst", Role.LAB_ANALYST),
    ("am", "Assistant Manager", Role.AM),
    ("dm", "Deputy Manager", Role.DM),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for username, default_name, role in USERS:
            user = db.scalar(select(User).where(User.username == username))
            current = user.full_name if user and "(demo)" not in user.full_name else default_name
            full_name = input(f"Full name shown for '{username}' [{current}]: ").strip() or current
            while True:
                pw = getpass(f"Password for '{username}' ({role.value}), at least 8 characters: ")
                if len(pw) >= 8:
                    break
                print("  Too short, try again.")
            if user:
                user.password_hash = hash_password(pw)
                user.full_name = full_name
                print(f"  Updated {username}")
            else:
                db.add(User(username=username, full_name=full_name, role=role, password_hash=hash_password(pw)))
                print(f"  Created {username}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
