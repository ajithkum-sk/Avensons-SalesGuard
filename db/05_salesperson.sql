CREATE TABLE IF NOT EXISTS sg.collection (
  collection_id  bigserial PRIMARY KEY,
  customer_code  text NOT NULL REFERENCES sg.dim_customer(customer_code),
  salesman_key   integer REFERENCES sg.dim_salesman(salesman_key),
  document_ids   bigint[] NOT NULL,
  amount         numeric(14,2) NOT NULL,
  payment_mode   text NOT NULL CHECK (payment_mode IN ('cash','upi','cheque')),
  collected_on   date NOT NULL DEFAULT current_date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_collection_salesman ON sg.collection(salesman_key, collected_on);

CREATE TABLE IF NOT EXISTS sg.notification (
  notification_id bigserial PRIMARY KEY,
  salesman_key     integer REFERENCES sg.dim_salesman(salesman_key), -- NULL = broadcast to all
  title            text NOT NULL,
  body             text NOT NULL,
  link             text,
  is_read          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notification_salesman ON sg.notification(salesman_key, created_at);
