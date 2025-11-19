-- Migration: Add imagen_url column to productos table
-- Date: 2024
-- Description: Adds optional imagen_url field to store product images from Supabase Storage

ALTER TABLE productos
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- Create storage bucket for product images (run this in Supabase SQL Editor)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('productos-imagenes', 'productos-imagenes', true)
-- ON CONFLICT DO NOTHING;

-- Set storage policies (run this in Supabase SQL Editor)
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'productos-imagenes');
-- CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'productos-imagenes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE USING (bucket_id = 'productos-imagenes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING (bucket_id = 'productos-imagenes' AND auth.role() = 'authenticated');
