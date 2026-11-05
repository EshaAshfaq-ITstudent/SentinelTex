"""SQLite database connection (local file, works offline)."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DB_PATH

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns():
    """Small upgrade for databases made by an older version: create_all() makes new tables but never adds
    a column to an existing one. Each entry: table, column, SQL type."""
    wanted = [("messages", "recipient_id", "INTEGER REFERENCES users(id)")]
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, column, sql_type in wanted:
            if insp.has_table(table) and column not in {c["name"] for c in insp.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
