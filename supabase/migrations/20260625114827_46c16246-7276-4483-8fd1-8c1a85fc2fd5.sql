
-- Enums
CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.listing_status AS ENUM ('active', 'sold', 'removed');
CREATE TYPE public.listing_condition AS ENUM ('new', 'used');
CREATE TYPE public.contact_type AS ENUM ('phone', 'telegram', 'instagram', 'whatsapp', 'in_app');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin policies on user_roles
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seller verifications
CREATE TABLE public.seller_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  id_front_url TEXT NOT NULL,
  id_back_url TEXT NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.seller_verifications TO authenticated;
GRANT ALL ON public.seller_verifications TO service_role;
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own verification" ON public.seller_verifications FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Sellers insert own verification" ON public.seller_verifications FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins manage verifications" ON public.seller_verifications FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_am TEXT,
  name_or TEXT,
  name_so TEXT,
  icon TEXT,
  supports_condition BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (slug, name_en, name_am, name_or, name_so, icon, supports_condition, sort_order) VALUES
  ('phones', 'Phones', 'ስልኮች', 'Bilbilaa', 'Taleefannada', 'Smartphone', true, 1),
  ('computers', 'Computers', 'ኮምፒውተሮች', 'Kompiitara', 'Kombuyutaro', 'Laptop', true, 2),
  ('electronics', 'Electronics', 'ኤሌክትሮኒክስ', 'Elektrooniksii', 'Elektarooniga', 'Tv', true, 3),
  ('vehicles', 'Vehicles', 'ተሽከርካሪዎች', 'Konkolaata', 'Gawaadiid', 'Car', true, 4),
  ('houses', 'Houses & Property', 'ቤቶች', 'Manneen', 'Guryaha', 'Home', false, 5),
  ('furniture', 'Furniture', 'የቤት ዕቃዎች', 'Miʼa manaa', 'Alaabta', 'Sofa', true, 6),
  ('clothing', 'Clothing', 'ልብሶች', 'Uffata', 'Dharka', 'Shirt', true, 7),
  ('other', 'Other', 'ሌላ', 'Kan biroo', 'Kale', 'Package', true, 99);

-- Listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'ETB',
  condition public.listing_condition,
  location TEXT,
  status public.listing_status NOT NULL DEFAULT 'active',
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_category_idx ON public.listings(category_id);
CREATE INDEX listings_seller_idx ON public.listings(seller_id);
CREATE INDEX listings_status_idx ON public.listings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT SELECT ON public.listings TO anon;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings public read" ON public.listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved sellers create listings" ON public.listings FOR INSERT WITH CHECK (
  auth.uid() = seller_id AND EXISTS (
    SELECT 1 FROM public.seller_verifications WHERE seller_id = auth.uid() AND status = 'approved'
  )
);
CREATE POLICY "Sellers update own listings" ON public.listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers delete own listings" ON public.listings FOR DELETE USING (auth.uid() = seller_id);
CREATE POLICY "Admins manage listings" ON public.listings FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Listing attributes (free-form specs)
CREATE TABLE public.listing_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);
CREATE INDEX listing_attributes_listing_idx ON public.listing_attributes(listing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_attributes TO authenticated;
GRANT SELECT ON public.listing_attributes TO anon;
GRANT ALL ON public.listing_attributes TO service_role;
ALTER TABLE public.listing_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attrs follow listing read" ON public.listing_attributes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.status = 'active' OR l.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Sellers manage own attrs" ON public.listing_attributes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

-- Listing images
CREATE TABLE public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX listing_images_listing_idx ON public.listing_images(listing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_images TO authenticated;
GRANT SELECT ON public.listing_images TO anon;
GRANT ALL ON public.listing_images TO service_role;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Images follow listing read" ON public.listing_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.status = 'active' OR l.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Sellers manage own images" ON public.listing_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

-- Contact options
CREATE TABLE public.contact_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  type public.contact_type NOT NULL,
  value TEXT NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_options TO authenticated;
GRANT SELECT ON public.contact_options TO anon;
GRANT ALL ON public.contact_options TO service_role;
ALTER TABLE public.contact_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contact follows listing read" ON public.contact_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.status = 'active' OR l.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Sellers manage own contacts" ON public.contact_options FOR ALL USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_recipient_idx ON public.messages(recipient_id, created_at DESC);
CREATE INDEX messages_sender_idx ON public.messages(sender_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipients mark read" ON public.messages FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Admins read all messages" ON public.messages FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- SMS verification codes (server-side only)
CREATE TABLE public.sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sms_codes_phone_idx ON public.sms_codes(phone, created_at DESC);
GRANT ALL ON public.sms_codes TO service_role;
ALTER TABLE public.sms_codes ENABLE ROW LEVEL SECURITY;
-- no client policies; service role only

-- Admin logs
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read logs" ON public.admin_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert logs" ON public.admin_logs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
