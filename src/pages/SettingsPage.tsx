import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Moon, 
  Sun,
  Info
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false);
  const [privateMode, setPrivateMode] = useState(true);

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

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Pengaturan
        </h1>
        <p className="text-muted-foreground mt-1">
          Konfigurasi aplikasi Silsilah Keluarga
        </p>
      </div>

      {/* Appearance */}
      <Card className="p-6">
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
                Data disimpan lokal di perangkat ini saja
              </p>
            </div>
            <Switch
              id="private-mode"
              checked={privateMode}
              onCheckedChange={setPrivateMode}
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Tentang Penyimpanan Data</p>
              <p className="text-muted-foreground mt-1">
                Semua data Anda disimpan secara lokal di browser menggunakan IndexedDB. 
                Tidak ada data yang dikirim ke server. Pastikan untuk melakukan backup 
                secara berkala menggunakan fitur Export.
              </p>
            </div>
          </div>
        </div>
      </Card>

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
