CREATE POLICY "docs public read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');
CREATE POLICY "docs public upload" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "docs public delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'documents');