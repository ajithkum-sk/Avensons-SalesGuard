"""Load a CBE 'Sales Register - Itemwise' export into monthly_sales and
monthly_sales_category. Aggregates item-level rows up to customer+month
(and customer+category+month). Unmatched customers/salesmen are skipped
and reported, not silently dropped or fatal.

Usage: .venv/bin/python scripts/load_sales_register.py "/path/to/CBE JUNE26.xlsx"
"""
import sys
from collections import defaultdict
from datetime import date

import openpyxl
sys.path.insert(0, ".")
from app.db import execute, fetch_all, open_pool

HEADER_ROW = 12  # 1-indexed row containing 'Cagetory', 'Sub Category', ...
COL_CATEGORY = 0
COL_TOTAL = 16
COL_INVOICE_NO = 18
COL_INVOICE_DATE = 20
COL_OUTLET_ID = 21
COL_DS_NAME = 29


def main(path: str):
    open_pool()
    db_customers = {r["customer_code"] for r in fetch_all("SELECT customer_code FROM dim_customer")}
    db_salesmen = {r["salesman_name"]: r["salesman_key"] for r in fetch_all("SELECT salesman_name, salesman_key FROM dim_salesman")}

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]

    # (month, customer, salesman) -> {amount, invoices:set}
    cust_month: dict[tuple, dict] = defaultdict(lambda: {"amount": 0.0, "invoices": set(), "salesman_key": None})
    # (month, customer, category) -> {amount, invoices:set}
    cust_cat_month: dict[tuple, dict] = defaultdict(lambda: {"amount": 0.0, "invoices": set()})

    skipped_customer, skipped_salesman, total_rows = 0, 0, 0

    for row in ws.iter_rows(min_row=HEADER_ROW + 1, values_only=True):
        if not row or row[COL_OUTLET_ID] is None:
            continue
        total_rows += 1
        outlet = str(row[COL_OUTLET_ID]).strip()
        ds_name = str(row[COL_DS_NAME]).strip() if row[COL_DS_NAME] else None
        inv_date = row[COL_INVOICE_DATE]
        amount = float(row[COL_TOTAL] or 0)
        invoice_no = row[COL_INVOICE_NO]
        category = str(row[COL_CATEGORY]).strip() if row[COL_CATEGORY] else None

        if outlet not in db_customers:
            skipped_customer += 1
            continue
        salesman_key = db_salesmen.get(ds_name) if ds_name else None
        if ds_name and salesman_key is None:
            skipped_salesman += 1
            continue
        if not inv_date:
            continue

        month = date(inv_date.year, inv_date.month, 1)

        key = (month, outlet, salesman_key)
        cust_month[key]["amount"] += amount
        cust_month[key]["invoices"].add(invoice_no)
        cust_month[key]["salesman_key"] = salesman_key

        if category:
            ckey = (month, outlet, category)
            cust_cat_month[ckey]["amount"] += amount
            cust_cat_month[ckey]["invoices"].add(invoice_no)

    wb.close()

    for (month, customer, salesman_key), agg in cust_month.items():
        if salesman_key is None:
            continue
        execute(
            "INSERT INTO monthly_sales (month_start, customer_code, salesman_key, category, "
            "invoice_count, total_amount, source) VALUES (%s,%s,%s,NULL,%s,%s,'upload') "
            "ON CONFLICT (month_start, customer_code, salesman_key) DO UPDATE SET "
            "invoice_count = EXCLUDED.invoice_count, total_amount = EXCLUDED.total_amount, source = 'upload'",
            [month, customer, salesman_key, len(agg["invoices"]), round(agg["amount"], 2)],
        )

    for (month, customer, category), agg in cust_cat_month.items():
        execute(
            "INSERT INTO monthly_sales_category (month_start, customer_code, category, invoice_count, total_amount) "
            "VALUES (%s,%s,%s,%s,%s) ON CONFLICT (month_start, customer_code, category) DO UPDATE SET "
            "invoice_count = EXCLUDED.invoice_count, total_amount = EXCLUDED.total_amount",
            [month, customer, category, len(agg["invoices"]), round(agg["amount"], 2)],
        )

    print(f"Processed {total_rows} item rows from {path}")
    print(f"  monthly_sales rows written: {len(cust_month)}")
    print(f"  monthly_sales_category rows written: {len(cust_cat_month)}")
    print(f"  skipped rows (unmatched customer): {skipped_customer}")
    print(f"  skipped rows (unmatched salesman): {skipped_salesman}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: load_sales_register.py <path-to-xlsx>")
        sys.exit(1)
    main(sys.argv[1])
