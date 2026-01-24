import { supabase } from '@/integrations/supabase/client';

/**
 * Upload a file to Supabase Storage for evidence
 * Files are stored in the 'evidence' bucket under the user's folder
 */
export async function uploadEvidenceFile(
  file: File,
  evidenceId: string
): Promise<{ url: string; path: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create a unique file path: {userId}/{evidenceId}/{filename}
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${user.id}/${evidenceId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('evidence')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get the signed URL for accessing the file (valid for 1 year)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('evidence')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

  if (urlError) throw urlError;

  return {
    url: urlData.signedUrl,
    path: filePath,
  };
}

/**
 * Get a signed URL for an evidence file
 */
export async function getEvidenceFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete an evidence file from storage
 */
export async function deleteEvidenceFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('evidence')
    .remove([filePath]);

  if (error) throw error;
}

/**
 * Convert base64 data URL to File object
 */
export function base64ToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], fileName, { type: mime });
}
