import io
import markdown as md
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Literal, Optional
from database import get_db

router = APIRouter()


class ReportCreate(BaseModel):
    title: str
    report_type: Literal["code_review", "security_scan", "deploy_summary", "custom"]
    content_md: str
    severity_summary: dict = {}
    author: str = "claude"
    metadata: dict = {}


@router.get("")
async def list_reports(page: int = 1, limit: int = 20, report_type: Optional[str] = None):
    db = get_db()
    offset = (page - 1) * limit
    q = db.table("reports").select("id, created_at, title, report_type, severity_summary, author").order("created_at", desc=True)
    if report_type:
        q = q.eq("report_type", report_type)
    res = q.range(offset, offset + limit - 1).execute()
    return {"items": res.data, "page": page, "limit": limit}


@router.get("/{report_id}")
async def get_report(report_id: str):
    db = get_db()
    res = db.table("reports").select("*").eq("id", report_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    return res.data


@router.post("", status_code=201)
async def create_report(report: ReportCreate):
    db = get_db()
    res = db.table("reports").insert(report.model_dump()).execute()
    return res.data[0] if res.data else {}


@router.delete("/{report_id}", status_code=204)
async def delete_report(report_id: str):
    db = get_db()
    db.table("reports").delete().eq("id", report_id).execute()
    return None


def _build_pdf(title: str, content_md: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib.enums import TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, textColor=colors.HexColor("#1f2937"),
                        spaceAfter=8, spaceBefore=14)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#1f2937"),
                        spaceAfter=6, spaceBefore=12)
    h3 = ParagraphStyle("h3", parent=styles["Heading3"], fontSize=11, textColor=colors.HexColor("#374151"),
                        spaceAfter=4, spaceBefore=8)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=9, leading=12, alignment=TA_LEFT)
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#6b7280"))
    code_style = ParagraphStyle("code", parent=styles["Code"], fontSize=8, leading=10,
                                backColor=colors.HexColor("#f3f4f6"), borderPadding=4)

    story = []
    story.append(Paragraph(title, h1))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", meta))
    story.append(Spacer(1, 6))

    lines = content_md.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1; continue

        # Headers
        if line.startswith("### "):
            story.append(Paragraph(line[4:], h3))
        elif line.startswith("## "):
            story.append(Paragraph(line[3:], h2))
        elif line.startswith("# "):
            story.append(Paragraph(line[2:], h1))
        # HR
        elif line.strip() in ("---", "***", "___"):
            story.append(Spacer(1, 4))
        # Tables
        elif line.startswith("|") and i + 1 < len(lines) and lines[i+1].startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                rows.append(cells)
                i += 1
            if len(rows) >= 2 and all(set(c) <= set("- :") for c in rows[1]):
                rows.pop(1)
            if rows:
                t = Table(rows, repeatRows=1, hAlign="LEFT")
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f3f4f6")),
                    ("TEXTCOLOR",  (0,0), (-1,0), colors.HexColor("#1f2937")),
                    ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
                    ("FONTSIZE",   (0,0), (-1,-1), 8),
                    ("GRID",       (0,0), (-1,-1), 0.3, colors.HexColor("#d1d5db")),
                    ("VALIGN",     (0,0), (-1,-1), "TOP"),
                    ("LEFTPADDING",(0,0), (-1,-1), 4),
                    ("RIGHTPADDING",(0,0),(-1,-1), 4),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
            continue
        # Code block
        elif line.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            from html import escape
            story.append(Paragraph("<font face='Courier'>" + "<br/>".join(escape(l) for l in code_lines) + "</font>",
                                   code_style))
        # Bullet
        elif line.startswith(("- ", "* ", "+ ")):
            story.append(Paragraph("&bull; " + _md_inline(line[2:]), body))
        # Paragraph
        else:
            story.append(Paragraph(_md_inline(line), body))
        i += 1

    doc.build(story)
    return buf.getvalue()


def _md_inline(text: str) -> str:
    """Convert inline markdown (bold, italic, code, links) to reportlab HTML."""
    import re
    from html import escape
    out = escape(text)
    out = re.sub(r"`([^`]+)`", r"<font face='Courier' backColor='#f3f4f6'>\1</font>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2"><font color="#2563eb">\1</font></link>', out)
    return out


@router.get("/{report_id}/pdf")
async def download_pdf(report_id: str):
    db = get_db()
    res = db.table("reports").select("*").eq("id", report_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    r = res.data
    pdf = _build_pdf(r["title"], r["content_md"])
    filename = f"{r['title'].replace(' ', '_')[:40]}.pdf"
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/{report_id}/docx")
async def download_docx(report_id: str):
    from docx import Document
    from docx.shared import Pt
    db = get_db()
    res = db.table("reports").select("*").eq("id", report_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    r = res.data

    doc = Document()
    doc.add_heading(r["title"], level=0)
    p = doc.add_paragraph()
    run = p.add_run(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    run.italic = True

    lines = r["content_md"].split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1; continue
        if line.startswith("###"):
            doc.add_heading(line.lstrip("#").strip(), level=3)
        elif line.startswith("##"):
            doc.add_heading(line.lstrip("#").strip(), level=2)
        elif line.startswith("#"):
            doc.add_heading(line.lstrip("#").strip(), level=1)
        elif line.startswith("|") and i + 1 < len(lines) and lines[i+1].startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                rows.append(cells)
                i += 1
            if len(rows) >= 2 and all(set(c) <= set("- :") for c in rows[1]):
                rows.pop(1)
            if rows:
                table = doc.add_table(rows=len(rows), cols=len(rows[0]))
                table.style = "Light Grid Accent 1"
                for ri, row in enumerate(rows):
                    for ci, cell in enumerate(row):
                        if ci < len(table.rows[ri].cells):
                            table.rows[ri].cells[ci].text = cell
            continue
        elif line.startswith(("- ", "* ", "+ ")):
            doc.add_paragraph(line[2:].strip(), style="List Bullet")
        elif line.strip() in ("---", "***", "___"):
            doc.add_paragraph("─" * 60)
        elif line.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            cp = doc.add_paragraph("\n".join(code_lines))
            for run in cp.runs:
                run.font.name = "Courier New"
                run.font.size = Pt(9)
        else:
            doc.add_paragraph(line)
        i += 1

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    filename = f"{r['title'].replace(' ', '_')[:40]}.docx"
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"})
