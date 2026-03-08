/*
  # Add Shifts Support

  1. New Tables
    - `shifts`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `start_time` (time)
      - `end_time` (time)
      - `description` (text, nullable)
      - `created_at` (timestamp)

    - `employee_shifts`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `shift_id` (uuid, foreign key to shifts)
      - `assigned_date` (date)
      - `created_at` (timestamp)

  2. Modified Tables
    - `time_entries`
      - Add `shift_id` (uuid, nullable, foreign key to shifts)

  3. Security
    - Enable RLS on `shifts` and `employee_shifts` tables
    - Add policies for read and write access
*/

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shifts"
  ON shifts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  assigned_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read employee shifts"
  ON employee_shifts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create employee shifts"
  ON employee_shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update employee shifts"
  ON employee_shifts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete employee shifts"
  ON employee_shifts FOR DELETE
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
  END IF;
END $$;