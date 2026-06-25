
-- listing-images: public read, owner write
CREATE POLICY "Listing images public read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
CREATE POLICY "Listing images owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Listing images owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Listing images owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'listing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- seller-ids: owner + admin read; owner upload
CREATE POLICY "Seller IDs owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'seller-ids' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Seller IDs owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'seller-ids' AND auth.uid()::text = (storage.foldername(name))[1]);
