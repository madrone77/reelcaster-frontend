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

/**
 * Batch signed URLs for a list page — ONE storage round-trip instead of
 * N createSignedUrl calls. Returns a path→url map (failed paths omitted).
 */
export async function getCatchPhotoSignedUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error || !data) return out;
  for (const entry of data) {
    if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
  }
  return out;
}
