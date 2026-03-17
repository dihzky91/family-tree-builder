import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRateLimit } from '@/hooks/useRateLimit';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TreeDeciduous, Mail, Lock, User, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { useFamilyStore } from '@/store/familyStore';

const emailSchema = z.string().email('Email tidak valid');

// Enhanced password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordSchema = z.string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung minimal 1 huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka')
  .regex(/[^A-Za-z0-9]/, 'Password harus mengandung minimal 1 karakter khusus (!@#$%^&*)');

const nameSchema = z.string().min(2, 'Nama minimal 2 karakter').optional();

function hasRecoveryToken() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash).get('type') === 'recovery';
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { loadDemoData } = useFamilyStore();
  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  const handleDemoClick = () => {
    loadDemoData();
    navigate('/');
  };
  const { signIn, signUp, requestPasswordReset, updatePassword, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLocked, remainingAttempts, recordAttempt, resetAttempts, formatRemainingTime } = useRateLimit('login');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingUser, setHasExistingUser] = useState<boolean | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(hasRecoveryToken());

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  // Register form
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Check if user already exists (Single User Mode)
  useEffect(() => {
    const checkExistingUser = async () => {
      if (!hasSupabaseConfig) {
        setHasExistingUser(false);
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('has_registered_user');
      if (!error) {
        setHasExistingUser(data as boolean);
      }
    };
    checkExistingUser();
  }, [hasSupabaseConfig]);

  useEffect(() => {
    const syncRecoveryState = () => {
      setIsRecoveryMode(hasRecoveryToken());
    };

    syncRecoveryState();
    window.addEventListener('hashchange', syncRecoveryState);

    return () => window.removeEventListener('hashchange', syncRecoveryState);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isRecoveryMode) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isRecoveryMode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check if user is rate limited
    if (isLocked) {
      setError(`Terlalu banyak percobaan login. Silakan coba lagi dalam ${formatRemainingTime()}.`);
      return;
    }

    setIsLoading(true);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      // Record failed attempt
      recordAttempt();

      if (error.message.includes('Invalid login credentials')) {
        const remaining = remainingAttempts - 1;
        if (remaining <= 0) {
          setError(`Email atau password salah. Akun terkunci selama 15 menit karena terlalu banyak percobaan.`);
        } else {
          setError(`Email atau password salah. Sisa percobaan: ${remaining}`);
        }
      } else if (error.message.includes('Email not confirmed')) {
        setError('Email belum dikonfirmasi. Silakan cek inbox Anda.');
      } else {
        setError(error.message);
      }
    } else {
      // Login successful, reset attempts
      resetAttempts();
    }

    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      emailSchema.parse(registerEmail);
      passwordSchema.parse(registerPassword);
      if (registerName) nameSchema.parse(registerName);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    const { data, error } = await signUp(registerEmail, registerPassword, registerName || undefined);

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Email sudah terdaftar. Silakan login.');
      } else {
        setError(error.message);
      }
    } else if (data.user && !data.session) {
      setSuccess('Akun berhasil dibuat! Silakan cek email Anda untuk konfirmasi.');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterName('');
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      emailSchema.parse(resetEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    const { error } = await requestPasswordReset(resetEmail);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Link reset password sudah dikirim. Silakan cek email Anda.');
      setResetEmail('');
      setShowForgotPassword(false);
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      passwordSchema.parse(newPassword);
      if (newPassword !== confirmNewPassword) {
        throw new Error('Konfirmasi password baru tidak cocok');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else if (err instanceof Error) {
        setError(err.message);
      }
      setIsLoading(false);
      return;
    }

    const { error } = await updatePassword(newPassword);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password berhasil diperbarui. Silakan masuk dengan password baru Anda.');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsRecoveryMode(false);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, '/auth');
      }
    }

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        {!hasSupabaseConfig && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertDescription>
                Supabase belum dikonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY tersedia di environment production.
              </AlertDescription>
            </Alert>
          </div>
        )}
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <TreeDeciduous className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Silsilah Keluarga
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola dan visualisasikan silsilah keluarga Anda
          </p>
        </div>

        <Card className="border-border/50 shadow-xl">
          {isRecoveryMode ? (
            <form onSubmit={handleResetPassword}>
              <CardHeader>
                <CardTitle>Buat Password Baru</CardTitle>
                <CardDescription>
                  Gunakan password baru yang memenuhi kombinasi keamanan terbaru.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-primary/50 bg-primary/5">
                    <AlertDescription className="text-primary">
                      {success}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password">Password Baru</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Minimal 8 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Konfirmasi Password Baru</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Ulangi password baru"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Password harus mengandung minimal 8 karakter, 1 huruf besar, 1 huruf kecil, 1 angka, dan 1 karakter khusus.
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Simpan Password Baru'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsRecoveryMode(false);
                    setError(null);
                    if (typeof window !== 'undefined') {
                      window.history.replaceState({}, document.title, '/auth');
                    }
                  }}
                >
                  Kembali ke login
                </Button>
              </CardFooter>
            </form>
          ) : (
          <Tabs defaultValue="login" className="w-full">
            {!hasExistingUser && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="register">Daftar</TabsTrigger>
              </TabsList>
            )}

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardHeader>
                  <CardTitle>Selamat Datang</CardTitle>
                  <CardDescription>
                    Masuk ke akun Anda untuk melanjutkan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="border-primary/50 bg-primary/5">
                      <AlertDescription className="text-primary">
                        {success}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="nama@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {showForgotPassword && (
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-4">
                      <div>
                        <p className="font-medium text-sm text-foreground">Reset password via email</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Masukkan email akun Anda. Kami akan kirim link untuk membuat password baru.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email untuk reset</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="nama@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button type="button" className="flex-1" disabled={isLoading} onClick={handleForgotPassword}>
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Mengirim...
                              </>
                            ) : (
                              'Kirim Link Reset'
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setShowForgotPassword(false);
                              setResetEmail('');
                              setError(null);
                            }}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Masuk'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => {
                      setShowForgotPassword((prev) => !prev);
                      setSuccess(null);
                      setError(null);
                    }}
                  >
                    {showForgotPassword ? 'Tutup reset password' : 'Lupa password?'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            {/* Register Tab - Hidden in Single User Mode */}
            {!hasExistingUser && (
              <TabsContent value="register">
                <form onSubmit={handleRegister}>
                  <CardHeader>
                    <CardTitle>Buat Akun</CardTitle>
                    <CardDescription>
                      Daftar untuk mulai membuat silsilah keluarga
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    {success && (
                      <Alert className="border-primary/50 bg-primary/5">
                        <AlertDescription className="text-primary">
                          {success}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-name">Nama Lengkap</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-name"
                          type="text"
                          placeholder="John Doe"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="nama@email.com"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Minimal 8 karakter"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        'Daftar'
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            )}
          </Tabs>
          )}
        </Card>

        {/* Demo Button */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Atau
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 border-dashed border-2 hover:border-primary hover:bg-primary/5 gap-2"
            onClick={handleDemoClick}
          >
            <Sparkles className="w-4 h-4" />
            Coba Demo - Tanpa Login
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Explore fitur lengkap dengan data contoh keluarga Indonesia
          </p>
        </div>


      </div>
    </div>
  );
}
