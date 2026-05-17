from pydantic import BaseModel
from datetime import datetime
from typing import Any


class SecurityReport(BaseModel):
    build_number: int
    overall_status: str
    tools: dict[str, Any]
    duration_min: float | None = None
    triggered_by: str = "jenkins"


class SecurityReportRow(SecurityReport):
    id: str
    created_at: datetime


class PRReview(BaseModel):
    pr_number: int
    pr_title: str
    pr_author: str | None = None
    branch_name: str | None = None
    review_body: str | None = None
    status: str = "pending"
    claude_score: int | None = None
    comments: list[dict] = []


class PRReviewRow(PRReview):
    id: str
    created_at: datetime
