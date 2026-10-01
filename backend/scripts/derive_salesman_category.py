"""Derive sg.salesman_category from real sales data, as a stand-in until
Avensons confirms the real mapping (open question Q5). For each salesman,
assigns the single category that makes up the largest share of their sales
volume in monthly_sales_category, joined via outstanding_document to know
which salesman touched which customer+category.
"""
import sys
from collections import defaultdict

sys.path.insert(0, ".")
from app.db import execute, fetch_all, open_pool


def main():
    open_pool()

    # salesman -> customer set (from outstanding_document, any snapshot)
    rows = fetch_all(
        "SELECT DISTINCT salesman_key, customer_code FROM outstanding_document "
        "WHERE salesman_key IS NOT NULL"
    )
    customers_by_salesman: dict[int, set] = defaultdict(set)
    for r in rows:
        customers_by_salesman[r["salesman_key"]].add(r["customer_code"])

    # customer+category -> total amount (from real sales data)
    cat_rows = fetch_all(
        "SELECT customer_code, category, sum(total_amount) AS amount "
        "FROM monthly_sales_category WHERE category IS NOT NULL "
        "GROUP BY customer_code, category"
    )
    amount_by_customer_cat: dict[tuple, float] = {}
    for r in cat_rows:
        amount_by_customer_cat[(r["customer_code"], r["category"])] = float(r["amount"])

    inserted = 0
    for salesman_key, customers in customers_by_salesman.items():
        totals: dict[str, float] = defaultdict(float)
        for (cust, cat), amt in amount_by_customer_cat.items():
            if cust in customers:
                totals[cat] += amt
        if not totals:
            continue
        top_category = max(totals, key=totals.get)
        execute(
            "INSERT INTO salesman_category (salesman_key, category) VALUES (%s,%s) "
            "ON CONFLICT (salesman_key) DO UPDATE SET category = EXCLUDED.category",
            [salesman_key, top_category],
        )
        inserted += 1

    print(f"Salesmen mapped: {inserted}")


if __name__ == "__main__":
    main()
