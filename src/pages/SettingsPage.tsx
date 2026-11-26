import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Moon,
  Sun,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useFamilyStore } from '@/store/familyStore';
import { isSupabaseConfigured } from '@/storage';
import { useAuth } from '@/hooks/useAuth';
import { passwordSchema, getPasswordChecks } from '@/lib/password';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false);
  const { isPrivateMode, setPrivateMode } = useFamilyStore();
  const supabaseConfigured = isSupabaseConfigured();
  const { isAuthenticated, updatePassword, user } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const passwordChecks = getPasswordChecks(newPassword);

  useEffect(() => {
    // Check initial dark mode
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle('dark', newValue);
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      passwordSchema.parse(newPassword);
      if (newPassword !== confirmPassword) {
        setPasswordError('Konfirmasi password baru tidak cocok');
        return;
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setPasswordError(err.errors[0].message);
      }
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess('Password berhasil diperbarui.');
      setNewPassword('');
      setConfirmPassword('');
    }
    setIsUpdatingPassword(false);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
          Pengaturan
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
          Konfigurasi aplikasi Silsilah Keluarga
        </p>
      </div>

      {/* Appearance */}
      <Card className="p-4 sm:p-6 rounded-2xl">
        <h2 className="font-display font-semibold text-lg mb-4">Tampilan</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <div>
              <Label htmlFor="dark-mode" className="font-medium">Mode Gelap</Label>
              <p className="text-sm text-muted-foreground">
                Gunakan tema gelap untuk tampilan
              </p>
            </div>
          </div>
          <Switch
            id="dark-mode"
            checked={isDark}
            onCheckedChange={toggleDarkMode}
          />
        </div>
      </Card>

      {/* Privacy */}
      <Card className="p-6">
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Privasi & Keamanan
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="private-mode" className="font-medium">Mode Privat</Label>
              <p className="text-sm text-muted-foreground">
                {isPrivateMode
                  ? 'Data disimpan lokal di perangkat ini saja (IndexedDB)'
                  : 'Data disimpan di cloud (Supabase) untuk akun ini'}
              </p>
            </div>
            <Switch
              id="private-mode"
              checked={isPrivateMode}
              onCheckedChange={(value) => setPrivateMode(value)}
              disabled={!supabaseConfigured}
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Tentang Penyimpanan Data</p>
              <p className="text-muted-foreground mt-1">
                {isPrivateMode
                  ? 'Semua data Anda disimpan secara lokal di browser menggunakan IndexedDB. Tidak ada data yang dikirim ke server.'
                  : 'Data tersimpan di cloud dan terhubung ke akun Anda. Pastikan Anda menggunakan akun yang benar.'}
              </p>
              {!supabaseConfigured && (
                <p className="text-muted-foreground mt-2">
                  Supabase belum dikonfigurasi. Mode cloud dinonaktifkan dan aplikasi akan memakai penyimpanan lokal.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Change Password */}
      {supabaseConfigured && isAuthenticated && (
        <Card className="p-6">
          <h2 className="font-display font-semibold text-lg mb-1 flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Ubah Password
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Atur password baru untuk akun {user?.email ?? 'Anda'}.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            {passwordSuccess && (
              <Alert>
                <AlertDescription>{passwordSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="settings-new-password">Password Baru</Label>
              <div className="relative">
                <Input
                  id="settings-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      className={cn(
                        'flex items-center gap-1.5 text-xs',
                        check.valid ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                      )}
                    >
                      {check.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{check.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Input
                  id="settings-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Lihat konfirmasi password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isUpdatingPassword}>
              {isUpdatingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Password Baru
            </Button>
          </form>
        </Card>
      )}

      {/* About */}
      <Card className="p-6">
        <h2 className="font-display font-semibold text-lg mb-4">Tentang</h2>

        <div className="space-y-2 text-sm">
          <p><strong>Silsilah Keluarga</strong></p>
          <p className="text-muted-foreground">Versi 1.0.0</p>
          <p className="text-muted-foreground mt-4">
            Aplikasi untuk mengelola dan memvisualisasikan silsilah keluarga Anda.
            Dibangun dengan React, TypeScript, dan family-chart.
          </p>
        </div>
      </Card>
    </div>
  );
}
