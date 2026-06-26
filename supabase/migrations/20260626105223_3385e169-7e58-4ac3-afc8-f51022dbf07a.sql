
-- 1) contact_options: require authenticated user
DROP POLICY IF EXISTS "Contact follows listing read" ON public.contact_options;
CREATE POLICY "Contact follows listing read"
ON public.contact_options
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = contact_options.listing_id
      AND (
        l.status = 'active'::listing_status
        OR l.seller_id = auth.uid()
        OR private.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 2) listing-images storage: restrict public read to images of active listings; owner/admin can always read
DROP POLICY IF EXISTS "Listing images public read" ON storage.objects;
CREATE POLICY "Listing images active read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'listing-images'
  AND (
    EXISTS (
      SELECT 1
      FROM public.listing_images li
      JOIN public.listings l ON l.id = li.listing_id
      WHERE li.url LIKE '%' || storage.objects.name
        AND l.status = 'active'::listing_status
    )
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR private.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3) seller-ids: add UPDATE and DELETE policies (owner or admin)
CREATE POLICY "Seller IDs owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seller-ids'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR private.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  bucket_id = 'seller-ids'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR private.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Seller IDs owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'seller-ids'
  AND ((auth.uid())::text = (storage.foldername(name))[1]
       OR private.has_role(auth.uid(), 'admin'::app_role))
);
