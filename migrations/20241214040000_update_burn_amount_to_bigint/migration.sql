-- Convert the amount column to bigint while preserving data
ALTER TABLE burn_request ALTER COLUMN amount TYPE bigint USING amount::bigint; 