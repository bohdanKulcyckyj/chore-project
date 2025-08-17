-- Create storage bucket for task completion photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-completion-photos', 'task-completion-photos', true);

-- Set up storage policies for the bucket
-- Allow authenticated users to upload photos
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-completion-photos');

-- Allow authenticated users to view photos
CREATE POLICY "Allow authenticated reads" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'task-completion-photos');

-- Allow users to delete their own photos (optional - based on completion ownership)
CREATE POLICY "Allow completion owner to delete photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-completion-photos' 
  AND auth.uid()::text = (storage.foldername(name))[4] -- 4th folder level is user_id in our structure
);