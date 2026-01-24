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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Printer, FileText } from 'lucide-react';
import { printTree, type PaperSize } from '../utils/printTree';

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elementRef: React.RefObject<HTMLDivElement>;
  title?: string;
}

export function PrintDialog({ open, onOpenChange, elementRef, title = 'Silsilah Keluarga' }: PrintDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  const handlePrint = () => {
    if (!elementRef.current) return;
    
    printTree(elementRef.current, {
      paperSize,
      orientation,
      title,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Cetak Silsilah
          </DialogTitle>
          <DialogDescription>
            Pilih ukuran kertas dan orientasi untuk mencetak silsilah keluarga
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Paper Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Ukuran Kertas</Label>
            <RadioGroup
              value={paperSize}
              onValueChange={(v) => setPaperSize(v as PaperSize)}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  paperSize === 'a4'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="a4" id="a4" />
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">A4</p>
                    <p className="text-xs text-muted-foreground">210 × 297 mm</p>
                  </div>
                </div>
              </label>
              
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  paperSize === 'a3'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="a3" id="a3" />
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium">A3</p>
                    <p className="text-xs text-muted-foreground">297 × 420 mm</p>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Orientation */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Orientasi</Label>
            <RadioGroup
              value={orientation}
              onValueChange={(v) => setOrientation(v as 'portrait' | 'landscape')}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  orientation === 'portrait'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="portrait" id="portrait" />
                <div className="flex items-center gap-2">
                  <div className="w-4 h-6 border-2 border-muted-foreground rounded" />
                  <span className="font-medium">Portrait</span>
                </div>
              </label>
              
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  orientation === 'landscape'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value="landscape" id="landscape" />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 border-2 border-muted-foreground rounded" />
                  <span className="font-medium">Landscape</span>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Preview hint */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p>
              💡 <strong>Tips:</strong> Gunakan orientasi <em>Landscape</em> untuk silsilah yang lebar, 
              dan <em>A3</em> jika terdapat banyak anggota keluarga.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
