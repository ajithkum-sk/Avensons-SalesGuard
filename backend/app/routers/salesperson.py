"""Salesperson-facing endpoints: dashboard, shops, collections, notifications, profile."""
from datetime import date, datetime, timezone
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import execute, fetch_all, fetch_one
from ..deps import require_salesman
from ..schemas import CollectionIn, ViolationNoteIn

router = APIRouter(prefix="/api", tags=["salesperson"])

HIGH_DUE_THRESHOLD = 10000  # TODO: confirm real threshold with the team


def _latest_snapshot_id() -> int:
    row = fetch_one("SELECT snapshot_id FROM sg.snapshot ORDER BY snapshot_id DESC LIMIT 1")
    if not row:
        raise HTTPException(status_code=404, detail="No data loaded yet")
    return row["snapshot_id"]


def _latest_run_id() -> int | None:
    row = fetch_one("SELECT run_id FROM sg.rule_run ORDER BY run_id DESC LIMIT 1")
    return row["run_id"] if row else None


def _customer_status(customer_code: str, salesman_key: int, run_id: int | None, outstanding: float) -> str | None:
    if run_id is None:
        return "High Due" if outstanding > HIGH_DUE_THRESHOLD else None
    rules = {
        r["rule_code"]
        for r in fetch_all(
            "SELECT DISTINCT rule_code FROM sg.rule_violation "
            "WHERE run_id = %s AND customer_code = %s AND salesman_key = %s",
            [run_id, customer_code, salesman_key],
        )
    }
    if "R05_UNDERPERFORMING_SALESMAN" in rules:
        return "Colleague"
    if "R04_STOCK_DUMPING" in rules:
        return ">30 Avg"
    if outstanding > HIGH_DUE_THRESHOLD:
        return "High Due"
    return None


@router.get("/salesperson/dashboard")
def dashboard(user: dict = Depends(require_salesman)):
    sman = user["salesman_key"]
    snap = _latest_snapshot_id()
    run_id = _latest_run_id()

    totals_row = fetch_one(
        "SELECT COALESCE(SUM(balance), 0) AS total_due, "
        "COALESCE(SUM(balance) FILTER (WHERE overdue_days > 0), 0) AS overdue, "
        "COUNT(DISTINCT customer_code) FILTER (WHERE balance <= 0) AS good_outlets "
        "FROM sg.outstanding_document "
        "WHERE snapshot_id = %s AND salesman_key = %s AND NOT source_ignored",
        [snap, sman],
    )

    high_risk_shops = 0
    by_rule = []
    if run_id is not None:
        high_risk_shops = fetch_one(
            "SELECT COUNT(DISTINCT customer_code) AS n FROM sg.rule_violation "
            "WHERE run_id = %s AND salesman_key = %s AND severity = 'high'",
            [run_id, sman],
        )["n"]
        by_rule = fetch_all(
            "SELECT v.rule_code, r.title, COUNT(*) AS hits "
            "FROM sg.rule_violation v JOIN sg.rule r ON r.rule_code = v.rule_code "
            "WHERE v.run_id = %s AND v.salesman_key = %s "
            "GROUP BY v.rule_code, r.title ORDER BY hits DESC",
            [run_id, sman],
        )

    top_customers = fetch_all(
        "SELECT customer_code, SUM(balance) AS outstanding, MAX(overdue_days) AS due_days "
        "FROM sg.outstanding_document "
        "WHERE snapshot_id = %s AND salesman_key = %s AND NOT source_ignored "
        "GROUP BY customer_code HAVING SUM(balance) > 0 "
        "ORDER BY SUM(balance) DESC LIMIT 5",
        [snap, sman],
    )
    priority_shops = []
    for c in top_customers:
        name = fetch_one("SELECT customer_name FROM sg.dim_customer WHERE customer_code = %s", [c["customer_code"]])
        priority_shops.append({
            "customer_code": c["customer_code"],
            "customer_name": name["customer_name"] if name else c["customer_code"],
            "outstanding": float(c["outstanding"]),
            "due_days": c["due_days"],
            "status": _customer_status(c["customer_code"], sman, run_id, float(c["outstanding"])),
        })

    location_row = fetch_one(
        "SELECT b.location, COUNT(*) AS n FROM sg.outstanding_document d "
        "JOIN sg.dim_beat b ON b.beat_key = d.beat_key "
        "WHERE d.snapshot_id = %s AND d.salesman_key = %s AND b.location IS NOT NULL "
        "GROUP BY b.location ORDER BY n DESC LIMIT 1",
        [snap, sman],
    )

    perf_rows = fetch_all(
        "SELECT to_char(date_trunc('month', collected_on), 'YYYY-MM-01') AS month_start, "
        "SUM(amount) AS amount FROM sg.collection "
        "WHERE salesman_key = %s AND collected_on >= date_trunc('month', current_date) - interval '5 months' "
        "GROUP BY 1 ORDER BY 1",
        [sman],
    )
    by_month = {r["month_start"]: float(r["amount"]) for r in perf_rows}
    trend = []
    for i in range(5, -1, -1):
        m = (date.today().replace(day=1) - relativedelta(months=i))
        key = m.isoformat()
        trend.append({"label": m.strftime("%b"), "amount": by_month.get(key, 0.0)})
    this_month = trend[-1]["amount"] if trend else 0.0
    last_month = trend[-2]["amount"] if len(trend) > 1 else 0.0

    return {
        "location": location_row["location"] if location_row else None,
        "totals": {
            "total_due": float(totals_row["total_due"]),
            "overdue": float(totals_row["overdue"]),
            "high_risk_shops": high_risk_shops,
            "good_outlets": totals_row["good_outlets"],
        },
        "by_rule": by_rule,
        "priority_shops": priority_shops,
        "performance": {
            "this_month_collected": this_month,
            "last_month_collected": last_month,
            "trend": trend,
        },
    }


@router.get("/salesperson/shops")
def shops(
    user: dict = Depends(require_salesman),
    limit: int = Query(10, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = None,
    status: str | None = None,
):
    sman = user["salesman_key"]
    snap = _latest_snapshot_id()
    run_id = _latest_run_id()

    rows_raw = fetch_all(
        "SELECT d.customer_code, c.customer_name, SUM(d.balance) AS outstanding, "
        "MAX(d.overdue_days) AS due_days "
        "FROM sg.outstanding_document d JOIN sg.dim_customer c ON c.customer_code = d.customer_code "
        "WHERE d.snapshot_id = %s AND d.salesman_key = %s AND NOT d.source_ignored "
        "GROUP BY d.customer_code, c.customer_name HAVING SUM(d.balance) > 0 "
        "ORDER BY SUM(d.balance) DESC",
        [snap, sman],
    )

    enriched = []
    for r in rows_raw:
        st = _customer_status(r["customer_code"], sman, run_id, float(r["outstanding"]))
        enriched.append({
            "customer_code": r["customer_code"],
            "customer_name": r["customer_name"],
            "outstanding": float(r["outstanding"]),
            "due_days": r["due_days"],
            "status": st,
        })

    if search:
        needle = search.lower()
        enriched = [r for r in enriched if needle in r["customer_name"].lower()]

    if status and status != "all":
        keyword_map = {"high_due": "High Due", "colleague": "Colleague", "avg30": ">30 Avg"}
        if status in keyword_map:
            enriched = [r for r in enriched if r["status"] == keyword_map[status]]
        else:
            # treat as a raw rule_code, e.g. R01_DBN_OVERDUE
            flagged = {
                v["customer_code"]
                for v in fetch_all(
                    "SELECT DISTINCT customer_code FROM sg.rule_violation "
                    "WHERE run_id = %s AND salesman_key = %s AND rule_code = %s",
                    [run_id, sman, status],
                )
            } if run_id else set()
            enriched = [r for r in enriched if r["customer_code"] in flagged]

    total = len(enriched)
    total_due = sum(r["outstanding"] for r in enriched)
    page = enriched[offset: offset + limit]
    return {"total": total, "total_due": total_due, "rows": page}


@router.get("/salesperson/shops/{customer_code}")
def shop_detail(customer_code: str, user: dict = Depends(require_salesman)):
    sman = user["salesman_key"]
    snap = _latest_snapshot_id()
    run_id = _latest_run_id()

    customer = fetch_one("SELECT customer_name FROM sg.dim_customer WHERE customer_code = %s", [customer_code])
    if not customer:
        raise HTTPException(status_code=404, detail="Outlet not found")

    docs = fetch_all(
        "SELECT doc_key, document_no, balance, overdue_days AS due_days "
        "FROM sg.outstanding_document "
        "WHERE snapshot_id = %s AND salesman_key = %s AND customer_code = %s "
        "AND NOT source_ignored AND balance > 0 ORDER BY overdue_days DESC NULLS LAST",
        [snap, sman, customer_code],
    )

    total_outstanding = sum(float(d["balance"]) for d in docs)

    violation_by_doc = {}
    if run_id is not None:
        for v in fetch_all(
            "SELECT violation_id, doc_key, rule_code FROM sg.rule_violation "
            "WHERE run_id = %s AND salesman_key = %s AND customer_code = %s",
            [run_id, sman, customer_code],
        ):
            if v["doc_key"] is not None:
                violation_by_doc[v["doc_key"]] = v

    documents = []
    for d in docs:
        v = violation_by_doc.get(d["doc_key"])
        explanation = None
        violation_id = None
        status = _customer_status(customer_code, sman, run_id, float(d["balance"]))
        if v:
            violation_id = v["violation_id"]
            note = fetch_one(
                "SELECT note FROM sg.violation_note WHERE violation_id = %s ORDER BY created_at DESC LIMIT 1",
                [v["violation_id"]],
            )
            explanation = note["note"] if note else None
        documents.append({
            "document_id": d["doc_key"],
            "document_no": d["document_no"],
            "balance": float(d["balance"]),
            "due_days": d["due_days"],
            "status": status,
            "violation_id": violation_id,
            "explanation": explanation,
        })

    return {
        "customer": {"customer_name": customer["customer_name"], "total_outstanding": total_outstanding},
        "documents": documents,
    }


@router.post("/salesperson/collections")
def mark_collected(body: CollectionIn, user: dict = Depends(require_salesman)):
    execute(
        "INSERT INTO sg.collection (customer_code, salesman_key, document_ids, amount, payment_mode) "
        "VALUES (%s, %s, %s, %s, %s)",
        [body.customer_code, user["salesman_key"], body.document_ids, body.amount, body.payment_mode],
    )
    return {"message": "Collection recorded."}


@router.get("/salesperson/collections")
def collection_history(
    user: dict = Depends(require_salesman),
    limit: int = Query(10, le=100),
    offset: int = Query(0, ge=0),
    range: str = "this_month",
    mode: str | None = None,
):
    sman = user["salesman_key"]
    conditions = ["salesman_key = %s"]
    params: list = [sman]

    if range == "this_month":
        conditions.append("collected_on >= date_trunc('month', current_date)")
    elif range == "last_month":
        conditions.append(
            "collected_on >= date_trunc('month', current_date) - interval '1 month' "
            "AND collected_on < date_trunc('month', current_date)"
        )
    if mode:
        conditions.append("payment_mode = %s")
        params.append(mode)

    where = " AND ".join(conditions)
    total_row = fetch_one(
        f"SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM sg.collection WHERE {where}", params
    )
    rows = fetch_all(
        f"SELECT c.collection_id, c.collected_on, cu.customer_name, c.amount, c.payment_mode "
        f"FROM sg.collection c JOIN sg.dim_customer cu ON cu.customer_code = c.customer_code "
        f"WHERE {where} ORDER BY c.collected_on DESC, c.collection_id DESC LIMIT %s OFFSET %s",
        params + [limit, offset],
    )
    return {
        "total": total_row["n"],
        "total_collected": float(total_row["total"]),
        "rows": [
            {**r, "amount": float(r["amount"]), "collected_on": r["collected_on"].isoformat()} for r in rows
        ],
    }


def _time_ago(dt: datetime) -> str:
    delta = datetime.now(timezone.utc) - dt
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"{max(minutes, 0)}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    return f"{hours // 24}d ago"


@router.get("/salesperson/notifications")
def notifications(user: dict = Depends(require_salesman), range: str = "this_month", unread: str | None = None):
    sman = user["salesman_key"]
    conditions = ["(salesman_key = %s OR salesman_key IS NULL)"]
    params: list = [sman]
    if range == "this_month":
        conditions.append("created_at >= date_trunc('month', now())")
    if unread == "1":
        conditions.append("is_read = false")

    where = " AND ".join(conditions)
    rows = fetch_all(
        f"SELECT notification_id, title, body, link, is_read, created_at FROM sg.notification "
        f"WHERE {where} ORDER BY created_at DESC",
        params,
    )
    return {
        "rows": [
            {
                "id": r["notification_id"],
                "title": r["title"],
                "body": r["body"],
                "read": r["is_read"],
                "link": r["link"],
                "time_ago": _time_ago(r["created_at"]),
            }
            for r in rows
        ]
    }


@router.post("/salesperson/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, user: dict = Depends(require_salesman)):
    n = execute(
        "UPDATE sg.notification SET is_read = true "
        "WHERE notification_id = %s AND (salesman_key = %s OR salesman_key IS NULL)",
        [notification_id, user["salesman_key"]],
    )
    if n == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read."}


@router.get("/salesperson/profile")
def profile(user: dict = Depends(require_salesman)):
    sman = fetch_one("SELECT salesman_name FROM sg.dim_salesman WHERE salesman_key = %s", [user["salesman_key"]])
    snap = _latest_snapshot_id()
    location_row = fetch_one(
        "SELECT b.location, COUNT(*) AS n FROM sg.outstanding_document d "
        "JOIN sg.dim_beat b ON b.beat_key = d.beat_key "
        "WHERE d.snapshot_id = %s AND d.salesman_key = %s AND b.location IS NOT NULL "
        "GROUP BY b.location ORDER BY n DESC LIMIT 1",
        [snap, user["salesman_key"]],
    )
    return {
        "name": user["full_name"],
        "role_label": "Salesperson",
        "location": location_row["location"] if location_row else None,
        "photo_url": None,
        "phone": None,
        "employee_id": str(user["salesman_key"]),
        "joining_date": None,
    }


@router.post("/violations/{violation_id}/notes")
def add_violation_note(violation_id: int, body: ViolationNoteIn, user: dict = Depends(require_salesman)):
    v = fetch_one("SELECT violation_id FROM sg.rule_violation WHERE violation_id = %s", [violation_id])
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")
    execute(
        "INSERT INTO sg.violation_note (violation_id, author, note) VALUES (%s, %s, %s)",
        [violation_id, user["full_name"], body.note],
    )
    return {"message": "Note added."}
