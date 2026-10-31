"""Create the three demo users (one per role). Run once from the `backend` folder:

    python seed_users.py

Passwords are typed in by you (not stored in the code). Run again to reset a password.
"""
from getpass import getpass

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Role, User
from app.security import hash_password

USERS = [
    ("analyst", "Lab Analyst (demo)", Role.LAB_ANALYST),
    ("am", "Assistant Manager (demo)", Role.AM),
    ("dm", "Deputy Manager (demo)", Role.DM),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for username, full_name, role in USERS:
            while True:
                pw = getpass(f"Password for '{username}' ({role.value}), at least 8 characters: ")
                if len(pw) >= 8:
                    break
                print("  Too short, try again.")
            user = db.scalar(select(User).where(User.username == username))
            if user:
                user.password_hash = hash_password(pw)
                print(f"  Updated {username}")
            else:
                db.add(User(username=username, full_name=full_name, role=role, password_hash=hash_password(pw)))
                print(f"  Created {username}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
