// Catch-photo uploads to the private `catch-photos` Supabase Storage bucket.
// Objects are namespaced by user id (`${userId}/${uuid}.${ext}`) so the
// owner-only RLS policies apply. Reads go through short-lived signed URLs.

import { supabase } from "@/lib/supabase";

const BUCKET = "catch-photos";

/** Upload a catch photo and return its storage path (to persist in catch_logs.photos). */
export async function uploadCatchPhoto(
  file: File,
  userId: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Short-lived signed URL for displaying a stored catch photo (null on failure). */
export async function getCatchPhotoSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
