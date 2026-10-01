CREATE TABLE IF NOT EXISTS sg.location (
  location_id serial PRIMARY KEY,
  name        text NOT NULL UNIQUE
);

INSERT INTO sg.location (name) VALUES
  ('Coimbatore (CBE)'), ('Chennai'), ('Madurai'), ('Salem'), ('Trichy')
ON CONFLICT (name) DO NOTHING;
