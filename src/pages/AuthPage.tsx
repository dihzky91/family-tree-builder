import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
const passwordSchema = z.string().min(6, 'Password minimal 6 karakter');
const nameSchema = z.string().min(2, 'Nama minimal 2 karakter').optional();

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
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExistingUser, setHasExistingUser] = useState<boolean | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

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
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      if (error.message.includes('Invalid login credentials')) {
        setError('Email atau password salah');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Email belum dikonfirmasi. Silakan cek inbox Anda.');
      } else {
        setError(error.message);
      }
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
                </CardContent>
                <CardFooter>
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
                          placeholder="Minimal 6 karakter"
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
