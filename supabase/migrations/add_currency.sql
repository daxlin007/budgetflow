-- Add currency field to profiles table
ALTER TABLE public.profiles
ADD COLUMN currency TEXT DEFAULT 'USD' NOT NULL;

-- Add constraint to ensure valid currency codes (ISO 4217)
ALTER TABLE public.profiles
ADD CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$');

-- Create a comment for documentation
COMMENT ON COLUMN public.profiles.currency IS 'ISO 4217 currency code (e.g., USD, EUR, GBP, CAD)';
