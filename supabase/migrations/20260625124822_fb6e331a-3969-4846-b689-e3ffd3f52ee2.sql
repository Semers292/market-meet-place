ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'pending'::listing_status;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS rejection_reason text;