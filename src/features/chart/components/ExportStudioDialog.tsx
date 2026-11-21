import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BookOpen,
  Download,
  Image as ImageIcon,
  FileSpreadsheet,
  Copy,
  Loader2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  exportFamilyBookPdf,
  exportFamilyCsv,
  type BookThemeId,
  type FamilyBookSections,
} from '../utils/familyBookPdfExport';
import { exportTreeAsImage, copyTreeToClipboard } from '../utils/exportTreeAsImage';
import type { Evidence, Person, Relationship, Story } from '@/types';

interface ExportStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartElementRef: React.RefObject<HTMLDivElement>;
  viewLabel: string;
  selectedPersonName?: string | null;
  selectedPersonId?: string | null;
  persons: Person[];
  relationships: Relationship[];
  evidence: Evidence[];
  stories: Story[];
  generationsCount: number;
}

const THEME_OPTIONS: {
  id: BookThemeId;
  name: string;
  desc: string;
  swatches: [string, string, string];
}[] = [
  {
    id: 'heritage',
    name: 'Heritage',
    desc: 'Krem hangat & aksen emas',
    swatches: ['#fbf8f2', '#915222', '#cc8e2a'],
  },
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Slate bersih & aksen teal',
    swatches: ['#f8fafc', '#0f766e', '#0284c7'],
  },
  {
    id: 'minimal',
    name: 'Hemat Tinta',
    desc: 'Putih bersih siap cetak',
    swatches: ['#ffffff', '#27272a', '#71717a'],
  },
];

export function ExportStudioDialog({
  open,
  onOpenChange,
  chartElementRef,
  viewLabel,
  selectedPersonName,
  selectedPersonId,
  persons,
  relationships,
  evidence,
  stories,
  generationsCount,
}: ExportStudioDialogProps) {
  const [title, setTitle] = useState('Buku Silsilah Keluarga');
  const [subtitle, setSubtitle] = useState(
    selectedPersonName ? `Fokus: ${selectedPersonName}` : 'Dokumentasi & Arsip Keturunan'
  );
  const [theme, setTheme] = useState<BookThemeId>('heritage');
  const [sections, setSections] = useState<FamilyBookSections>({
    cover: true,
    analytics: true,
    diagram: true,
    directory: true,
    birthdaysAndStories: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  const toggleSection = (key: keyof FamilyBookSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;

  const handleExportPdf = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);
    try {
      const qrUrl = selectedPersonId
        ? `${window.location.origin}/chart?focus=${selectedPersonId}`
        : `${window.location.origin}/chart`;

      await exportFamilyBookPdf({
        title: title.trim() || 'Buku Silsilah Keluarga',
        subtitle: subtitle.trim() || undefined,
        theme,
        sections,
        viewLabel,
        qrUrl,
        persons,
        relationships,
        evidence,
        stories,
        chartElement: chartElementRef.current,
      });
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickImage = async (format: 'png' | 'svg') => {
    if (!chartElementRef.current) return;
    await exportTreeAsImage(chartElementRef.current, {
      format,
      filename: 'silsilah-keluarga',
    });
  };

  const handleCopyClipboard = async () => {
    if (!chartElementRef.current) return;
    await copyTreeToClipboard(chartElementRef.current);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <BookOpen className="h-5 w-5 text-primary" />
            Export Studio — Buku Silsilah PDF
          </DialogTitle>
          <DialogDescription>
            Susun dokumentasi keluarga lengkap dengan sampul, infografis statistik, diagram bersih,
            direktori per generasi, hingga kalender ulang tahun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Summary Pills */}
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
              {persons.length} anggota
            </span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
              {generationsCount} generasi
            </span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
              {stories.length} kisah
            </span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5">
              Diagram aktif: {viewLabel}
            </span>
          </div>

          {/* Title & Subtitle */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="book-title" className="text-xs font-medium">
                Judul Dokumen
              </Label>
              <Input
                id="book-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Buku Silsilah Keluarga..."
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book-subtitle" className="text-xs font-medium">
                Subjudul / Catatan
              </Label>
              <Input
                id="book-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Keluarga Besar..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Theme Picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tema Desain PDF</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map((opt) => {
                const isActive = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={cn(
                      'relative rounded-xl border p-2.5 text-left transition-all',
                      isActive
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border/70 hover:border-primary/40'
                    )}
                  >
                    {isActive && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      {opt.swatches.map((hex, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-foreground">{opt.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sections Checklist */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Isi Halaman PDF</Label>
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              {[
                {
                  key: 'cover' as const,
                  title: 'Halaman Sampul & Ringkasan KPI',
                  desc: 'Judul keluarga, rentang tahun, ringkasan 6 metrik utama, dan QR Code',
                },
                {
                  key: 'analytics' as const,
                  title: 'Infografis Grafik & Fakta Menarik',
                  desc: 'Grafik pertumbuhan generasi, donut gender/hidup, dekade kelahiran & sorotan unik',
                },
                {
                  key: 'diagram' as const,
                  title: `Diagram Silsilah Aktif (${viewLabel})`,
                  desc: 'Halaman Landscape bersih tanpa tombol UI atau kontrol zoom',
                },
                {
                  key: 'directory' as const,
                  title: 'Direktori Anggota per Generasi',
                  desc: 'Daftar lengkap seluruh anggota, pasangan, jumlah anak & domisili',
                },
                {
                  key: 'birthdaysAndStories' as const,
                  title: 'Kalender Ulang Tahun & Kisah Keluarga',
                  desc: 'Jadwal ulang tahun Jan–Des beserta rangkuman kisah keluarga tercatat',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2.5 cursor-pointer rounded-lg p-1.5 hover:bg-background/70 transition-colors"
                >
                  <Checkbox
                    checked={sections[item.key]}
                    onCheckedChange={() => toggleSection(item.key)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Alternative Exports */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Export Cepat Lainnya
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { void handleQuickImage('png'); }}
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { void handleQuickImage('svg'); }}
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                SVG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => { void handleCopyClipboard(); }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Salin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => exportFamilyCsv(persons, relationships)}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Batal
          </Button>
          <Button
            onClick={() => { void handleExportPdf(); }}
            disabled={isExporting || selectedCount === 0 || persons.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyusun PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Unduh Buku PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
