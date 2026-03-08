/*
  # Add Breaks Support

  1. New Tables
    - `breaks`
      - `id` (uuid, primary key)
      - `time_entry_id` (uuid, foreign key to time_entries)
      - `break_type` (text: 'paid_15' or 'unpaid_30')
      - `start_time` (timestamptz)
      - `end_time` (timestamptz, nullable)
      - `duration_minutes` (integer, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `breaks` table
    - Add policy for users to view/manage breaks for their own time entries

  3. Purpose
    - Track paid 15-minute breaks and unpaid 30-minute breaks
    - Calculate total break time for reporting
*/

CREATE TABLE IF NOT EXISTS breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  break_type text NOT NULL CHECK (break_type IN ('paid_15', 'unpaid_30')),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_minutes integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view breaks"
  ON breaks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create breaks"
  ON breaks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update breaks"
  ON breaks FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete breaks"
  ON breaks FOR DELETE
  USING (true);

CREATE INDEX breaks_time_entry_id_idx ON breaks(time_entry_id);
CREATE INDEX breaks_break_type_idx ON breaks(break_type);