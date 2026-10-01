ALTER TABLE sg.snapshot ADD COLUMN IF NOT EXISTS location_id integer REFERENCES sg.location(location_id);
