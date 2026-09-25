"""Clear and reseed the SQLite database with upcoming meetings only."""

from datetime import datetime, timedelta

from database import Base, SessionLocal, engine
from models import Meeting

FRONTEND_ORIGIN = "http://localhost:3000"


def invite_link(code: str) -> str:
    compact = code.replace(" ", "")
    return f"{FRONTEND_ORIGIN}/join/{compact}"


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        db.add_all(
            [
                Meeting(
                    meeting_code="847 2931 5602",
                    title="Weekly product standup",
                    description="Sync on sprint progress and blockers.",
                    host_name="You",
                    meeting_type="scheduled",
                    scheduled_at=now + timedelta(days=1, hours=2),
                    duration_minutes=30,
                    status="upcoming",
                    invite_link=invite_link("847 2931 5602"),
                    created_at=now - timedelta(days=2),
                    ended_at=None,
                ),
                Meeting(
                    meeting_code="102 8845 3371",
                    title="Design review — dashboard",
                    description="Walk through Zoom-style dashboard mockups.",
                    host_name="You",
                    meeting_type="scheduled",
                    scheduled_at=now + timedelta(days=3, hours=5),
                    duration_minutes=45,
                    status="upcoming",
                    invite_link=invite_link("102 8845 3371"),
                    created_at=now - timedelta(days=1),
                    ended_at=None,
                ),
            ]
        )
        db.commit()
        print("Seeded 2 upcoming meetings. Recent is empty until a meeting is ended.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
