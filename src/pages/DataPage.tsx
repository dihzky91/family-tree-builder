import { useState, useRef } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Download,
  Upload,
  FileJson,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Trash2,
  Share2
} from 'lucide-react';
import { generateGedcom } from '@/features/chart/utils/gedcomExport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function DataPage() {
  const { exportData, importData, clearAllData, persons, relationships, evidence, stories } = useFamilyStore();
  const [importText, setImportText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `silsilah-keluarga-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Export berhasil',
        description: 'File JSON telah diunduh',
      });
    } catch (error) {
      toast({
        title: 'Export gagal',
        description: 'Terjadi kesalahan saat mengekspor data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    // Export persons as CSV
    const headers = ['id', 'fullName', 'gender', 'birthDate', 'deathDate', 'notes', 'tags', 'confidenceScore'];
    const rows = persons.map(p => [
      p.id,
      `"${p.fullName}"`,
      p.gender,
      p.birthDate || '',
      p.deathDate || '',
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      `"${p.tags.join(', ')}"`,
      p.confidenceScore,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silsilah-keluarga-persons-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export CSV berhasil',
      description: 'File CSV telah diunduh',
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      validateImport(text);
    };
    reader.readAsText(file);
  };

  const validateImport = (text: string) => {
    setImportError(null);
    setImportPreview(null);

    try {
      const data = JSON.parse(text);

      if (!data.persons || !Array.isArray(data.persons)) {
        throw new Error('Format tidak valid: data "persons" tidak ditemukan');
      }

      setImportPreview({
        version: data.version || 'unknown',
        personsCount: data.persons.length,
        relationshipsCount: data.relationships?.length || 0,
        evidenceCount: data.evidence?.length || 0,
        storiesCount: data.stories?.length || 0,
        exportedAt: data.exportedAt,
      });
    } catch (error: any) {
      setImportError(error.message || 'Format JSON tidak valid');
    }
  };

  const handleImport = async () => {
    if (!importText || importError) return;

    setIsImporting(true);
    try {
      await importData(importText);
      setImportText('');
      setImportPreview(null);
      toast({
        title: 'Import berhasil',
        description: 'Data telah berhasil diimpor',
      });
    } catch (error: any) {
      toast({
        title: 'Import gagal',
        description: error.message || 'Terjadi kesalahan saat mengimpor data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearAll = async () => {
    await clearAllData();
    setShowClearConfirm(false);
    toast({
      title: 'Data dihapus',
      description: 'Semua data telah dihapus',
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Import / Export
        </h1>
        <p className="text-muted-foreground mt-1">
          Kelola backup dan restore data silsilah
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Export Data</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Unduh data silsilah Anda dalam format JSON atau CSV untuk backup.
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Data yang tersedia:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {persons.length} anggota keluarga</li>
                <li>• {relationships.length} relasi</li>
                <li>• {evidence.length} dokumen</li>
                <li>• {stories.length} cerita</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleExportJSON}
                disabled={isExporting || persons.length === 0}
                className="flex-1 gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={persons.length === 0}
                className="flex-1 gap-2"
              >
                <FileText className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const gedcom = generateGedcom(persons, relationships);
                  const blob = new Blob([gedcom], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `silsilah-keluarga-${new Date().toISOString().split('T')[0]}.ged`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({
                    title: 'Export GEDCOM berhasil',
                    description: 'File .ged telah diunduh',
                  });
                }}
                disabled={persons.length === 0}
                className="flex-1 gap-2"
              >
                <Share2 className="w-4 h-4" />
                Export GEDCOM
              </Button>
            </div>
          </div>
        </Card>

        {/* Import Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Import Data</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Restore data dari file backup JSON.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Pilih file JSON</Label>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="importText">Atau paste JSON di sini</Label>
              <Textarea
                id="importText"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (e.target.value) validateImport(e.target.value);
                }}
                placeholder='{"version": "1.0.0", "persons": [...], ...}'
                rows={6}
                className="mt-1 font-mono text-sm"
              />
            </div>

            {importError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">{importError}</p>
              </div>
            )}

            {importPreview && (
              <div className="flex items-start gap-2 p-3 bg-success/10 text-success rounded-lg">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Preview:</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>Versi: {importPreview.version}</li>
                    <li>{importPreview.personsCount} anggota</li>
                    <li>{importPreview.relationshipsCount} relasi</li>
                    <li>{importPreview.evidenceCount} dokumen</li>
                    <li>{importPreview.storiesCount} cerita</li>
                  </ul>
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!importText || !!importError || isImporting}
              className="w-full gap-2"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import Data
            </Button>
          </div>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-display font-semibold text-lg text-destructive">Zona Berbahaya</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Aksi di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda sudah membackup data sebelum melanjutkan.
        </p>

        <Button
          variant="destructive"
          onClick={() => setShowClearConfirm(true)}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Semua Data
        </Button>
      </Card>

      {/* Clear Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Semua Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus <strong>{persons.length}</strong> anggota, <strong>{relationships.length}</strong> relasi, dan <strong>{evidence.length}</strong> dokumen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
