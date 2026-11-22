import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Camera, Loader2, Save, User, Mail, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { uploadAvatar, deleteAvatar } from '@/lib/avatarStorage';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function ProfilePage() {
  const { user, profile, updateProfile, isLoading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with profile data
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Nama tampilan tidak boleh kosong');
      return;
    }

    if (displayName.trim().length < 2) {
      toast.error('Nama tampilan minimal 2 karakter');
      return;
    }

    setIsSaving(true);

    try {
      let newAvatarUrl = profile?.avatar_url;

      // Upload new avatar if selected
      if (avatarFile) {
        // Delete old avatar first
        if (profile?.avatar_url) {
          await deleteAvatar(profile.avatar_url);
        }
        
        newAvatarUrl = await uploadAvatar(avatarFile);
      }

      // Update profile
      const { error } = await updateProfile({
        display_name: displayName.trim(),
        avatar_url: newAvatarUrl,
      });

      if (error) {
        throw error;
      }

      // Clear file state
      setAvatarFile(null);
      setAvatarPreview(null);
      
      toast.success('Profil berhasil diperbarui');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Gagal memperbarui profil: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatar = avatarPreview || profile?.avatar_url;
  const hasChanges = 
    displayName !== (profile?.display_name || '') || 
    avatarFile !== null;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Kelola informasi profil dan foto Anda
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Foto Profil</CardTitle>
            <CardDescription>
              Ketuk foto untuk mengubah. Gunakan gambar JPG atau PNG (maks. 2MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative group shrink-0">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={currentAvatar || undefined} alt={displayName || 'Avatar'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Ubah foto profil"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md border-2 border-background"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Pilih Foto
                </Button>
                {avatarFile && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 truncate">
                    File dipilih: {avatarFile.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Informasi Profil</CardTitle>
            <CardDescription>
              Perbarui nama tampilan Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nama Tampilan
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Masukkan nama tampilan"
                maxLength={100}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Bergabung Sejak
                </Label>
                <p className="text-sm font-medium">
                  {user?.created_at 
                    ? format(new Date(user.created_at), 'd MMMM yyyy', { locale: id })
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={isSaving || !hasChanges}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Perubahan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
