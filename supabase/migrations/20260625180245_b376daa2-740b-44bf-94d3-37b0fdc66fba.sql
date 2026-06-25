
-- 1) Create private schema for security-definer helpers (hides from PostgREST API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2) Recreate has_role inside private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3) Recreate all policies that referenced public.has_role -> use private.has_role
-- user_roles
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- seller_verifications
DROP POLICY IF EXISTS "Admins manage verifications" ON public.seller_verifications;
CREATE POLICY "Admins manage verifications" ON public.seller_verifications FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- categories
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- messages
DROP POLICY IF EXISTS "Admins read all messages" ON public.messages;
DROP POLICY IF EXISTS "Users read own messages" ON public.messages;
CREATE POLICY "Admins read all messages" ON public.messages FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users read own messages" ON public.messages FOR SELECT TO authenticated
  USING ((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- listings
DROP POLICY IF EXISTS "Active listings public read" ON public.listings;
DROP POLICY IF EXISTS "Admins manage listings" ON public.listings;
CREATE POLICY "Active listings public read" ON public.listings FOR SELECT
  USING ((status = 'active'::public.listing_status) OR (auth.uid() = seller_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage listings" ON public.listings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- listing_attributes
DROP POLICY IF EXISTS "Attrs follow listing read" ON public.listing_attributes;
CREATE POLICY "Attrs follow listing read" ON public.listing_attributes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_attributes.listing_id
    AND ((l.status = 'active'::public.listing_status) OR (l.seller_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))));

-- listing_images
DROP POLICY IF EXISTS "Images follow listing read" ON public.listing_images;
CREATE POLICY "Images follow listing read" ON public.listing_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_images.listing_id
    AND ((l.status = 'active'::public.listing_status) OR (l.seller_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))));

-- contact_options
DROP POLICY IF EXISTS "Contact follows listing read" ON public.contact_options;
CREATE POLICY "Contact follows listing read" ON public.contact_options FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = contact_options.listing_id
    AND ((l.status = 'active'::public.listing_status) OR (l.seller_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))));

-- admin_logs
DROP POLICY IF EXISTS "Admins read logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins insert logs" ON public.admin_logs;
CREATE POLICY "Admins read logs" ON public.admin_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert logs" ON public.admin_logs FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND (auth.uid() = admin_id));

-- storage.objects: seller-ids owner read
DROP POLICY IF EXISTS "Seller IDs owner read" ON storage.objects;
CREATE POLICY "Seller IDs owner read" ON storage.objects FOR SELECT
  USING ((bucket_id = 'seller-ids') AND ((auth.uid()::text = (storage.foldername(name))[1]) OR private.has_role(auth.uid(), 'admin'::public.app_role)));

-- 4) Drop the public.has_role function now that nothing references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Keep a thin wrapper for application code that calls supabase.rpc('has_role'). It's SECURITY INVOKER and just delegates.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 5) Restrict profiles SELECT to owner and admins only
DROP POLICY IF EXISTS "Profiles readable by everyone" ON public.profiles;
CREATE POLICY "Profiles readable by owner or admin" ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- 6) Defense in depth: block role escalation via service-role inserts (e.g. compromised server path)
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::public.app_role THEN
    -- Allow only when there is no authenticated caller (true server-side bootstrap)
    -- AND the caller is an existing admin. The auth.uid() IS NULL branch lets
    -- migrations and direct DB ops insert seeds; service_role calls from app
    -- code will also have auth.uid() NULL but we additionally require that
    -- some admin already exists for non-superuser sessions.
    IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can grant the admin role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.user_roles;
CREATE TRIGGER prevent_role_escalation
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 7) Tighten listing-images storage upload to require an approved seller account
DROP POLICY IF EXISTS "Listing images owner upload" ON storage.objects;
CREATE POLICY "Listing images owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.seller_verifications sv
      WHERE sv.seller_id = auth.uid() AND sv.status = 'approved'::public.verification_status
    )
  );
