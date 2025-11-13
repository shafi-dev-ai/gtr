-- ============================================================================
-- Add Additional Fields to Listings Table
-- Run this script in Supabase SQL Editor if you want to add fuel_type, 
-- drive_type, and horsepower fields
-- ============================================================================

-- Add fuel_type column
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS fuel_type TEXT;

-- Add drive_type column
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS drive_type TEXT;

-- Add horsepower column (in kW)
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS horsepower INTEGER;

-- Add power column (alternative to horsepower, in kW as decimal)
-- ALTER TABLE listings 
-- ADD COLUMN IF NOT EXISTS power DECIMAL(6, 2);

-- Update existing listings with sample data
-- Note: Adjust these values based on your actual GT-R models

UPDATE listings
SET 
  fuel_type = 'Petrol',
  drive_type = 'AWD',
  horsepower = CASE 
    WHEN model LIKE '%Nismo%' THEN 600
    WHEN model LIKE '%R35%' THEN 565
    WHEN model LIKE '%R34%' THEN 276
    WHEN model LIKE '%R33%' THEN 276
    WHEN model LIKE '%R32%' THEN 276
    ELSE 565
  END
WHERE fuel_type IS NULL OR drive_type IS NULL OR horsepower IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN listings.fuel_type IS 'Fuel type: Petrol, Diesel, Electric, Hybrid';
COMMENT ON COLUMN listings.drive_type IS 'Drive type: AWD, RWD, FWD';
COMMENT ON COLUMN listings.horsepower IS 'Horsepower in kW (kilowatts)';

-- Optional: Add check constraints for data validation
-- ALTER TABLE listings 
-- ADD CONSTRAINT check_fuel_type 
-- CHECK (fuel_type IN ('Petrol', 'Diesel', 'Electric', 'Hybrid'));

-- ALTER TABLE listings 
-- ADD CONSTRAINT check_drive_type 
-- CHECK (drive_type IN ('AWD', 'RWD', 'FWD'));

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check if columns were added:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'listings' 
-- AND column_name IN ('fuel_type', 'drive_type', 'horsepower');

-- Check updated data:
-- SELECT id, model, fuel_type, drive_type, horsepower 
-- FROM listings 
-- LIMIT 5;
-- ============================================================================

