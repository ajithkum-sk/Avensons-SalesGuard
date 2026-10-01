CREATE TABLE IF NOT EXISTS sg.monthly_sales_category (
  month_start    date NOT NULL,
  customer_code  text NOT NULL REFERENCES sg.dim_customer(customer_code),
  category       text NOT NULL,
  invoice_count  integer NOT NULL DEFAULT 0,
  total_amount   numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (month_start, customer_code, category)
);
