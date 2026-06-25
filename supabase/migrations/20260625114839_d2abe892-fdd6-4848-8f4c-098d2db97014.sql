
-- Fix mutable search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- has_role: revoke public/anon execute. RLS policies still work because
-- they evaluate as the table-owner role via the policy machinery.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- sms_codes is service-role only; add explicit deny-all-anon policy for clarity
CREATE POLICY "sms_codes service only" ON public.sms_codes FOR ALL USING (false) WITH CHECK (false);
