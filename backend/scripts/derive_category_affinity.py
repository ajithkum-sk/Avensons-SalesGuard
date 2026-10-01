"""Derive sg.category_affinity from real purchase co-occurrence in
monthly_sales_category, as a stand-in until Avensons confirms the real
mapping (open question Q6). For each category, finds the other category
most frequently bought by the same customers in the same month, and links
them both ways if the co-occurrence is strong enough.
"""
import sys
from collections import defaultdict

sys.path.insert(0, ".")
from app.db import execute, fetch_all, open_pool

MIN_COOCCURRENCE_PCT = 40  # only link if at least this % of A-buyers also buy B
TOP_N_PER_CATEGORY = 2      # link each category to its top N partners


def main():
    open_pool()

    # ensure every real category exists in dim_category first (FK requirement)
    cats = fetch_all("SELECT DISTINCT category FROM monthly_sales_category WHERE category IS NOT NULL")
    execute(
        "INSERT INTO dim_category (category) SELECT unnest(%s::text[]) "
        "ON CONFLICT (category) DO NOTHING",
        [[c["category"] for c in cats]],
    )

    # customer -> set of categories bought (any month)
    rows = fetch_all(
        "SELECT DISTINCT customer_code, category FROM monthly_sales_category WHERE category IS NOT NULL"
    )
    by_customer: dict[str, set] = defaultdict(set)
    for r in rows:
        by_customer[r["customer_code"]].add(r["category"])

    category_customers: dict[str, set] = defaultdict(set)
    for cust, cats_bought in by_customer.items():
        for cat in cats_bought:
            category_customers[cat].add(cust)

    pairs_inserted = 0
    for cat_a, buyers_a in category_customers.items():
        scores = []
        for cat_b, buyers_b in category_customers.items():
            if cat_a == cat_b:
                continue
            overlap = len(buyers_a & buyers_b)
            pct = 100 * overlap / len(buyers_a) if buyers_a else 0
            if pct >= MIN_COOCCURRENCE_PCT:
                scores.append((pct, cat_b))
        scores.sort(reverse=True)
        for pct, cat_b in scores[:TOP_N_PER_CATEGORY]:
            execute(
                "INSERT INTO category_affinity (category, expects_category) VALUES (%s,%s) "
                "ON CONFLICT DO NOTHING",
                [cat_a, cat_b],
            )
            pairs_inserted += 1

    print(f"Categories seeded: {len(cats)}")
    print(f"Affinity pairs inserted: {pairs_inserted}")


if __name__ == "__main__":
    main()
