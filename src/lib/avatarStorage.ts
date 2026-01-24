import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'avatars';

/**
 * Upload avatar file to Supabase Storage
 * Files are stored in the 'avatars' bucket under the user's folder
 */
export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate file
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar');
  }
  
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    throw new Error('Ukuran file maksimal 2MB');
  }

  // Create unique file path: {userId}/{timestamp}.{ext}
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Delete avatar from storage using the URL
 */
export async function deleteAvatar(avatarUrl: string): Promise<void> {
  if (!avatarUrl) return;

  // Extract file path from URL
  // URL format: https://xxx.supabase.co/storage/v1/object/public/avatars/{userId}/{filename}
  const urlParts = avatarUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
  if (urlParts.length !== 2) return;

  const filePath = urlParts[1];
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Error deleting avatar:', error);
    // Don't throw - old avatar deletion failing shouldn't block new upload
  }
}

/**
 * Helper to get avatar path for a user
 */
export function getAvatarPath(userId: string, fileName: string): string {
  return `${userId}/${fileName}`;
}
