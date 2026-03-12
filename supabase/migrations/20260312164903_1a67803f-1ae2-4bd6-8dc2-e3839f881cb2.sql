
-- Create storage bucket for prospect files (leases, documents, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('prospect-files', 'prospect-files', false);

-- Allow authenticated users to upload files
CREATE POLICY "Auth users can upload prospect files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'prospect-files');

-- Allow authenticated users to read files
CREATE POLICY "Auth users can read prospect files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'prospect-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Auth users can delete prospect files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'prospect-files');

-- Create a metadata table to track which files belong to which prospect
CREATE TABLE public.prospect_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT '',
  uploaded_by UUID NOT NULL,
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read prospect files metadata"
ON public.prospect_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Auth users can insert prospect files metadata"
ON public.prospect_files FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Only uploader can delete file metadata"
ON public.prospect_files FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());
