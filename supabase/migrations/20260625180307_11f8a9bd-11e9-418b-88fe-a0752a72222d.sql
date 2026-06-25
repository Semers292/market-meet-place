
-- Move trigger function to private schema (don't expose SECURITY DEFINER fn in public)
DROP TRIGGER IF EXISTS prevent_role_escalation ON public.user_roles;
DROP FUNCTION IF EXISTS public.prevent_role_self_escalation();

CREATE OR REPLACE FUNCTION private.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::public.app_role THEN
    IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can grant the admin role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.prevent_role_self_escalation() FROM PUBLIC;

CREATE TRIGGER prevent_role_escalation
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.prevent_role_self_escalation();

-- Lock the public wrapper: revoke from anon (RLS only needs authenticated/service_role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
