"""HTTP surface. Thin: validate, delegate, return rows."""
from __future__ import annotations

import csv
import io
import json
import shutil
import tempfile
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from ..db import fetch_all, fetch_one, execute, conn
from ..ingest import load_snapshot, load_sales_register
from ..rules import RULES, RuleFailure, run_rules
from ..schemas import (ExceptionIn, GlobalConfigIn, NoteIn, RuleParamsIn, RunRequest)

router = APIRouter(prefix="/api")


# ------------------------------------------------------------------ snapshots

@router.get("/snapshots")
def list_snapshots():
    return fetch_all(
        """SELECT s.*,
                  CASE WHEN s.snapshot_type = 'monthly'
                       THEN s.row_count
                       ELSE (SELECT count(*) FROM outstanding_document d
                              WHERE d.snapshot_id = s.snapshot_id)
                  END AS documents
           FROM snapshot s ORDER BY snapshot_date DESC, snapshot_id DESC"""
    )


@router.post("/snapshots/upload")
async def upload_snapshot(
    file: UploadFile = File(...),
    snapshot_type: str = Form("daily"),
    snapshot_date: str | None = Form(None),
    location_id: int | None = Form(None),
    run_rules_after: bool = Form(True),
):
    if not file.filename.lower().endswith((".xlsx", ".xls", ".xlsm")):
        raise HTTPException(400, "Upload the Excel outstanding report (.xlsx)")
    tmp = Path(tempfile.mkdtemp()) / file.filename
    with tmp.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)
    def _parse_snapshot_date(s: str) -> date:
        if len(s) == 7:  # "YYYY-MM" from a month-only picker
            s = f"{s}-01"
        return date.fromisoformat(s)

    parsed_date = _parse_snapshot_date(snapshot_date) if snapshot_date else None
    try:
        if snapshot_type == "monthly":
            loaded = load_sales_register(tmp, snapshot_date=parsed_date, location_id=location_id)
        else:
            loaded = load_snapshot(tmp, snapshot_date=parsed_date, snapshot_type=snapshot_type, location_id=location_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)

    if run_rules_after and snapshot_type != "monthly":
        loaded["run"] = _run(loaded["snapshot_id"], None)
    return loaded


# ---------------------------------------------------------------------- runs

def _run(snapshot_id: int | None, only: list[str] | None):
    if snapshot_id is None:
        row = fetch_one(
            "SELECT snapshot_id FROM snapshot WHERE snapshot_type != 'monthly' "
            "ORDER BY snapshot_date DESC, snapshot_id DESC LIMIT 1"
        )
        if not row:
            raise HTTPException(409, "No snapshot loaded yet - upload an outstanding file first")
        snapshot_id = row["snapshot_id"]
    try:
        return run_rules(snapshot_id, only)
    except RuleFailure as exc:
        raise HTTPException(500, str(exc)) from exc


@router.post("/runs")
def create_run(req: RunRequest):
    return _run(req.snapshot_id, req.only)


@router.get("/runs")
def list_runs(limit: int = 20):
    return fetch_all(
        """SELECT r.*, s.snapshot_date, s.snapshot_type,
                  (SELECT count(*) FROM rule_violation v WHERE v.run_id = r.run_id) AS violations
           FROM rule_run r JOIN snapshot s USING (snapshot_id)
           ORDER BY r.run_id DESC LIMIT %s""",
        (limit,),
    )


def _latest_run_id() -> int:
    row = fetch_one("SELECT run_id FROM rule_run WHERE status='success' ORDER BY run_id DESC LIMIT 1")
    if not row:
        raise HTTPException(409, "No successful rule run yet")
    return row["run_id"]


def _run_ids_for_locations(location_ids: list[int] | None) -> list[int]:
    """Latest successful run per requested location. No location_ids = every
    location that has a successful run. Combining multiple locations assumes
    customer codes are not shared across locations - if the same outlet ever
    appears in two locations' files, its money totals would be counted twice."""
    if location_ids:
        where = "AND s.location_id = ANY(%(loc)s)"
        args = {"loc": location_ids}
    else:
        where = ""
        args = {}
    rows = fetch_all(
        f"""SELECT DISTINCT ON (s.location_id) r.run_id
            FROM rule_run r JOIN snapshot s USING (snapshot_id)
            WHERE r.status = 'success' {where}
            ORDER BY s.location_id, r.run_id DESC""",
        args,
    )
    run_ids = [r["run_id"] for r in rows]
    if not run_ids:
        raise HTTPException(409, "No successful rule run yet for the selected location(s)")
    return run_ids


# ------------------------------------------------------------------ dashboard

@router.get("/dashboard")
def dashboard(run_id: int | None = None, location_id: list[int] | None = Query(None)):
    run_ids = [run_id] if run_id else _run_ids_for_locations(location_id)
    runs = fetch_all(
        """SELECT r.*, s.snapshot_date, s.snapshot_type, s.source_file, s.location_id,
                  l.name AS location_name
           FROM rule_run r JOIN snapshot s USING (snapshot_id)
           LEFT JOIN location l ON l.location_id = s.location_id
           WHERE r.run_id = ANY(%(run_ids)s) ORDER BY r.run_id""",
        {"run_ids": run_ids},
    )
    by_rule = fetch_all(
        """SELECT ru.rule_code, ru.title, ru.purpose, ru.data_note, ru.audience,
                  ru.rule_group, ru.severity, ru.is_enabled,
                  bool_and(coalesce(d.status,'skipped') != 'skipped') AS ran,
                  coalesce(sum(d.hits),0) AS hits,
                  (SELECT count(DISTINCT v.customer_code) FROM rule_violation v
                    WHERE v.run_id = ANY(%(run_ids)s) AND v.rule_code=ru.rule_code) AS customers,
                  (SELECT coalesce(sum(v.balance),0) FROM rule_violation v
                    WHERE v.run_id = ANY(%(run_ids)s) AND v.rule_code=ru.rule_code) AS exposure
           FROM rule ru
           LEFT JOIN rule_run_detail d ON d.run_id = ANY(%(run_ids)s) AND d.rule_code=ru.rule_code
           GROUP BY ru.rule_code, ru.title, ru.purpose, ru.data_note, ru.audience,
                    ru.rule_group, ru.severity, ru.is_enabled, ru.sort_order
           ORDER BY ru.sort_order""",
        {"run_ids": run_ids},
    )
    totals = fetch_one(
        """SELECT count(*) AS violations,
                  count(DISTINCT customer_code) AS customers,
                  count(DISTINCT salesman_key) AS salesmen,
                  coalesce(sum(balance),0) AS exposure
           FROM rule_violation WHERE run_id = ANY(%(run_ids)s)""",
        {"run_ids": run_ids},
    )
    worst_salesmen = fetch_all(
        """SELECT s.salesman_name, s.salesman_type, count(*) AS flags,
                  coalesce(sum(v.balance),0) AS exposure
           FROM rule_violation v JOIN dim_salesman s USING (salesman_key)
           WHERE v.run_id = ANY(%(run_ids)s) GROUP BY 1,2 ORDER BY exposure DESC LIMIT 10""",
        {"run_ids": run_ids},
    )
    worst_customers = fetch_all(
        """SELECT v.customer_code, c.customer_name, c.channel_type, count(*) AS flags,
                  coalesce(sum(v.balance),0) AS exposure
           FROM rule_violation v JOIN dim_customer c USING (customer_code)
           WHERE v.run_id = ANY(%(run_ids)s) GROUP BY 1,2,3 ORDER BY exposure DESC LIMIT 10""",
        {"run_ids": run_ids},
    )
    return {"runs": runs, "run_ids": run_ids, "totals": totals, "by_rule": by_rule,
            "top_salesmen": worst_salesmen, "top_customers": worst_customers}


# ----------------------------------------------------------------- violations

# only these columns may be used for sorting - never interpolate sort_by directly
SORTABLE_COLUMNS = {
    "customer_name": "customer_name",
    "salesman_name": "salesman_name",
    "document_no": "document_no",
    "amount": "amount",
    "balance": "balance",
    "overdue_days": "overdue_days",
    "reason": "reason",
}


def _violation_query(run_ids: list[int], rule_code: str | None, search: str | None,
                     salesman_key: int | None, severity: str | None,
                     limit: int, offset: int,
                     customer_search: str | None = None,
                     salesman_search: str | None = None,
                     min_overdue_days: int | None = None,
                     max_overdue_days: int | None = None):
    where = ["run_id = ANY(%(run_ids)s)"]
    args: dict = {"run_ids": run_ids, "limit": limit, "offset": offset}
    if min_overdue_days is not None:
        where.append("overdue_days >= %(min_overdue_days)s")
        args["min_overdue_days"] = min_overdue_days
    if max_overdue_days is not None:
        where.append("overdue_days <= %(max_overdue_days)s")
        args["max_overdue_days"] = max_overdue_days
    if rule_code:
        where.append("rule_code = %(rule_code)s")
        args["rule_code"] = rule_code
    if salesman_key:
        where.append("salesman_key = %(salesman_key)s")
        args["salesman_key"] = salesman_key
    if severity:
        where.append("severity = %(severity)s")
        args["severity"] = severity
    if search:
        where.append("(customer_name ILIKE %(q)s OR customer_code ILIKE %(q)s "
                     "OR salesman_name ILIKE %(q)s OR document_no ILIKE %(q)s)")
        args["q"] = f"%{search}%"
    if customer_search:
        where.append("(customer_name ILIKE %(customer_q)s OR customer_code ILIKE %(customer_q)s)")
        args["customer_q"] = f"%{customer_search}%"
    if salesman_search:
        where.append("salesman_name ILIKE %(salesman_q)s")
        args["salesman_q"] = f"%{salesman_search}%"
    clause = " AND ".join(where)
    return clause, args


def _order_clause(sort_by: str | None, sort_dir: str | None) -> str:
    if not sort_by or sort_by not in SORTABLE_COLUMNS:
        return "ORDER BY balance DESC NULLS LAST, overdue_days DESC NULLS LAST"
    direction = "DESC" if (sort_dir or "").lower() == "desc" else "ASC"
    col = SORTABLE_COLUMNS[sort_by]
    return f"ORDER BY {col} {direction} NULLS LAST"


@router.get("/violations")
def violations(
    run_id: int | None = None,
    location_id: list[int] | None = Query(None),
    rule_code: str | None = None,
    search: str | None = None,
    salesman_key: int | None = None,
    severity: str | None = None,
    customer_search: str | None = None,
    salesman_search: str | None = None,
    min_overdue_days: int | None = None,
    max_overdue_days: int | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
):
    run_ids = [run_id] if run_id else _run_ids_for_locations(location_id)
    clause, args = _violation_query(run_ids, rule_code, search, salesman_key, severity, limit, offset,
                                    customer_search, salesman_search, min_overdue_days, max_overdue_days)
    order = _order_clause(sort_by, sort_dir)
    rows = fetch_all(
        f"""SELECT * FROM v_violation WHERE {clause}
            {order}
            LIMIT %(limit)s OFFSET %(offset)s""",
        args,
    )
    total = fetch_one(f"SELECT count(*) AS n, coalesce(sum(balance),0) AS exposure "
                      f"FROM v_violation WHERE {clause}", args)
    return {"run_ids": run_ids, "total": total["n"], "exposure": total["exposure"], "rows": rows}


@router.get("/violations.csv")
def violations_csv(
    run_id: int | None = None,
    location_id: list[int] | None = Query(None),
    rule_code: str | None = None,
    search: str | None = None,
    salesman_key: int | None = None,
    severity: str | None = None,
    customer_search: str | None = None,
    salesman_search: str | None = None,
    min_overdue_days: int | None = None,
    max_overdue_days: int | None = None,
    sort_by: str | None = None,
    sort_dir: str | None = None,
):
    run_ids = [run_id] if run_id else _run_ids_for_locations(location_id)
    clause, args = _violation_query(run_ids, rule_code, search, salesman_key, severity, 100000, 0,
                                    customer_search, salesman_search, min_overdue_days, max_overdue_days)
    order = _order_clause(sort_by, sort_dir) if sort_by else "ORDER BY rule_code, balance DESC NULLS LAST"
    rows = fetch_all(
        f"""SELECT rule_code, rule_title, severity, customer_code, customer_name, channel_type,
                   salesman_name, salesman_type, raw_beat AS beat, document_no, document_date,
                   amount, balance, overdue_days, reason
            FROM v_violation WHERE {clause}
            {order}""",
        args,
    )
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["rule_code"])
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    name = f"salesguard_{rule_code or 'all'}_run{'-'.join(map(str, run_ids))}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/customers/{customer_code}")
def customer_detail(customer_code: str, run_id: int | None = None):
    run_id = run_id or _latest_run_id()
    customer = fetch_one("SELECT * FROM dim_customer WHERE customer_code=%s", (customer_code,))
    if not customer:
        raise HTTPException(404, "Customer not found")
    docs = fetch_all(
        """SELECT d.document_type, d.document_no, d.document_date, d.amount, d.balance,
                  d.due_days, d.overdue_days, d.invoice_status, s.salesman_name, b.raw_beat
           FROM outstanding_document d
           LEFT JOIN dim_salesman s USING (salesman_key)
           LEFT JOIN dim_beat b USING (beat_key)
           WHERE d.snapshot_id = (SELECT snapshot_id FROM rule_run WHERE run_id=%s)
             AND d.customer_code=%s
           ORDER BY d.document_date DESC""",
        (run_id, customer_code),
    )
    flags = fetch_all(
        "SELECT * FROM v_violation WHERE run_id=%s AND customer_code=%s ORDER BY rule_code",
        (run_id, customer_code),
    )
    sales = fetch_all(
        """SELECT month_start, sum(total_amount) AS amount, sum(invoice_count) AS invoices
           FROM monthly_sales WHERE customer_code=%s GROUP BY 1 ORDER BY 1 DESC LIMIT 6""",
        (customer_code,),
    )
    return {"customer": customer, "documents": docs, "violations": flags, "monthly_sales": sales}


@router.get("/salesmen")
def salesmen(run_id: int | None = None, location_id: list[int] | None = Query(None)):
    run_ids = [run_id] if run_id else _run_ids_for_locations(location_id)
    return fetch_all(
        """SELECT s.salesman_key, s.salesman_name, s.salesman_type,
                  count(v.violation_id) AS flags,
                  coalesce(sum(v.balance),0) AS exposure,
                  count(DISTINCT v.customer_code) AS customers
           FROM dim_salesman s
           LEFT JOIN rule_violation v ON v.salesman_key=s.salesman_key AND v.run_id = ANY(%(run_ids)s)
           GROUP BY 1,2,3 ORDER BY exposure DESC""",
        {"run_ids": run_ids},
    )


# --------------------------------------------------------------------- config

@router.get("/rules")
def list_rules():
    return fetch_all(
        """SELECT r.*, (r.rule_code = ANY (%s)) AS implemented
           FROM rule r ORDER BY sort_order""",
        (list(RULES.keys()),),
    )


@router.patch("/rules/{rule_code}")
def update_rule(rule_code: str, body: RuleParamsIn):
    current = fetch_one("SELECT * FROM rule WHERE rule_code=%s", (rule_code,))
    if not current:
        raise HTTPException(404, "Unknown rule")
    params = {**(current["params"] or {}), **(body.params or {})}
    execute(
        """UPDATE rule SET params=%s,
                  is_enabled=coalesce(%s, is_enabled),
                  severity=coalesce(%s, severity),
                  updated_at=now()
            WHERE rule_code=%s""",
        (json.dumps(params), body.is_enabled, body.severity, rule_code),
    )
    return fetch_one("SELECT * FROM rule WHERE rule_code=%s", (rule_code,))


@router.get("/config")
def get_config():
    return fetch_one("SELECT params, updated_at FROM global_config WHERE id")


@router.put("/config")
def put_config(body: GlobalConfigIn):
    current = fetch_one("SELECT params FROM global_config WHERE id")
    merged = {**(current["params"] if current else {}), **body.params}
    execute(
        """INSERT INTO global_config (id, params) VALUES (true, %s)
           ON CONFLICT (id) DO UPDATE SET params=EXCLUDED.params, updated_at=now()""",
        (json.dumps(merged),),
    )
    return {"params": merged}


@router.get("/exceptions")
def list_exceptions():
    return fetch_all(
        """SELECT e.*, c.customer_name, s.salesman_name
           FROM rule_exception e
           LEFT JOIN dim_customer c USING (customer_code)
           LEFT JOIN dim_salesman s USING (salesman_key)
           ORDER BY e.exception_id DESC"""
    )


@router.post("/exceptions")
def add_exception(body: ExceptionIn):
    if not body.customer_code and not body.salesman_key:
        raise HTTPException(400, "Give a customer, a salesman, or both")
    row = fetch_one(
        """INSERT INTO rule_exception (rule_code, customer_code, salesman_key, note)
           VALUES (%s,%s,%s,%s) RETURNING *""",
        (body.rule_code, body.customer_code, body.salesman_key, body.note),
    )
    return row


@router.delete("/exceptions/{exception_id}")
def drop_exception(exception_id: int):
    execute("UPDATE rule_exception SET is_active=false WHERE exception_id=%s", (exception_id,))
    return {"exception_id": exception_id, "is_active": False}


@router.post("/violations/{violation_id}/notes")
def add_note(violation_id: int, body: NoteIn):
    return fetch_one(
        """INSERT INTO violation_note (violation_id, author, note)
           VALUES (%s,%s,%s) RETURNING *""",
        (violation_id, body.author, body.note),
    )


@router.get("/violations/{violation_id}/notes")
def get_notes(violation_id: int):
    return fetch_all(
        "SELECT * FROM violation_note WHERE violation_id=%s ORDER BY created_at",
        (violation_id,),
    )


# ------------------------------------------------------- category / salesman map

@router.get("/masters/categories")
def categories():
    return {
        "categories": fetch_all("SELECT * FROM dim_category ORDER BY category"),
        "affinity": fetch_all("SELECT * FROM category_affinity ORDER BY category"),
        "mapped_salesmen": fetch_all(
            """SELECT sc.salesman_key, s.salesman_name, sc.category
               FROM salesman_category sc JOIN dim_salesman s USING (salesman_key)
               ORDER BY s.salesman_name"""
        ),
    }


@router.put("/masters/salesman-category")
def map_salesman(salesman_key: int, category: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """INSERT INTO salesman_category (salesman_key, category) VALUES (%s,%s)
               ON CONFLICT (salesman_key) DO UPDATE SET category=EXCLUDED.category""",
            (salesman_key, category),
        )
    return {"salesman_key": salesman_key, "category": category}


@router.get("/masters/locations")
def list_locations():
    return fetch_all("SELECT * FROM location ORDER BY name")


@router.post("/masters/locations")
def add_location(name: str):
    existing = fetch_one("SELECT * FROM location WHERE name=%s", (name,))
    if existing:
        raise HTTPException(400, "That location already exists")
    return fetch_one("INSERT INTO location (name) VALUES (%s) RETURNING *", (name,))


@router.delete("/masters/locations/{location_id}")
def delete_location(location_id: int):
    n = execute("DELETE FROM location WHERE location_id=%s", (location_id,))
    if n == 0:
        raise HTTPException(404, "Location not found")
    return {"location_id": location_id, "deleted": True}


@router.delete("/snapshots/{snapshot_id}")
def delete_snapshot(snapshot_id: int):
    existing = fetch_one("SELECT snapshot_id FROM snapshot WHERE snapshot_id=%s", (snapshot_id,))
    if not existing:
        raise HTTPException(404, "Snapshot not found")
    execute("DELETE FROM snapshot WHERE snapshot_id=%s", (snapshot_id,))
    return {"snapshot_id": snapshot_id, "deleted": True}


@router.get("/salesmen/monthly")
def salesmen_monthly(month: str):
    """Per-salesman sales performance for one calendar month, compared to
    their own trailing 3-month average (same average logic as R16)."""
    try:
        month_start = date.fromisoformat(month)
    except ValueError:
        raise HTTPException(400, "month must be YYYY-MM-01")

    current = fetch_all(
        """SELECT salesman_key, sum(total_amount) AS amount, sum(invoice_count) AS invoices
           FROM monthly_sales WHERE month_start = %s AND salesman_key IS NOT NULL
           GROUP BY 1""",
        (month_start,),
    )
    hist = fetch_all(
        """SELECT salesman_key, sum(total_amount) / 3.0 AS avg_amount
           FROM monthly_sales
           WHERE month_start >= (%s::date - interval '3 months')
             AND month_start < %s::date
             AND salesman_key IS NOT NULL
           GROUP BY 1""",
        (month_start, month_start),
    )
    hist_by_key = {h["salesman_key"]: float(h["avg_amount"]) for h in hist}

    smen = fetch_all("SELECT salesman_key, salesman_name, salesman_type FROM dim_salesman")
    smen_by_key = {s["salesman_key"]: s for s in smen}

    rows = []
    for c in current:
        key = c["salesman_key"]
        info = smen_by_key.get(key, {})
        avg = hist_by_key.get(key, 0)
        rows.append({
            "salesman_key": key,
            "salesman_name": info.get("salesman_name", f"#{key}"),
            "salesman_type": info.get("salesman_type"),
            "amount": float(c["amount"]),
            "invoices": c["invoices"],
            "avg_amount": round(avg, 2),
            "pct_of_avg": round(100 * float(c["amount"]) / avg, 1) if avg > 0 else None,
        })
    rows.sort(key=lambda r: r["amount"], reverse=True)

    cats = fetch_all(
        """SELECT ms.salesman_key, msc.category, sum(msc.total_amount) AS amount
           FROM monthly_sales ms
           JOIN outstanding_document d ON d.salesman_key = ms.salesman_key
           JOIN monthly_sales_category msc ON msc.customer_code = d.customer_code
                                            AND msc.month_start = ms.month_start
           WHERE ms.month_start = %s
           GROUP BY 1,2""",
        (month_start,),
    ) if False else []  # category-per-salesman needs a direct link; see note below

    return {"month": month, "rows": rows}
