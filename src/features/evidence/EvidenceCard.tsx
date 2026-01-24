import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Evidence, VerificationStatus } from '@/types';
import { calculateConfidenceAdjustment } from '@/lib/confidenceScore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle,
  Clock,
  XCircle,
  File,
  FileText,
  Image as ImageIcon,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvidenceCardProps {
  evidence: Evidence;
  entityName: string;
  onStatusChange: (newStatus: VerificationStatus) => void;
  onDelete: () => void;
}

const statusConfig: Record<VerificationStatus, { 
  icon: typeof CheckCircle; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  draft: { 
    icon: File, 
    label: 'Draft', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted'
  },
  under_review: { 
    icon: Clock, 
    label: 'Dalam Review', 
    color: 'text-warning',
    bgColor: 'bg-warning/10'
  },
  verified: { 
    icon: CheckCircle, 
    label: 'Terverifikasi', 
    color: 'text-success',
    bgColor: 'bg-success/10'
  },
  rejected: { 
    icon: XCircle, 
    label: 'Ditolak', 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
};

const docTypeLabels: Record<string, string> = {
  birth_certificate: 'Akta Lahir',
  family_card: 'Kartu Keluarga',
  marriage_certificate: 'Surat Nikah',
  death_certificate: 'Akta Kematian',
  photo: 'Foto',
  other: 'Lainnya',
};

export function EvidenceCard({ evidence, entityName, onStatusChange, onDelete }: EvidenceCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<VerificationStatus | null>(null);

  const config = statusConfig[evidence.status];
  const StatusIcon = config.icon;
  const isImage = evidence.fileName?.match(/\.(jpg|jpeg|png|webp)$/i);

  const handleStatusSelect = (newStatus: VerificationStatus) => {
    if (newStatus === evidence.status) return;
    
    const adjustment = calculateConfidenceAdjustment(evidence.status, newStatus);
    setPendingStatus(newStatus);
    setShowStatusChange(true);
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      onStatusChange(pendingStatus);
      setPendingStatus(null);
      setShowStatusChange(false);
    }
  };

  const adjustment = pendingStatus 
    ? calculateConfidenceAdjustment(evidence.status, pendingStatus)
    : null;

  return (
    <>
      <div className="group p-4 bg-card border rounded-lg hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Thumbnail / Icon */}
            <div className={cn(
              "w-14 h-14 rounded-lg flex items-center justify-center shrink-0",
              config.bgColor
            )}>
              {evidence.fileData && isImage ? (
                <img 
                  src={evidence.fileData} 
                  alt={evidence.fileName || 'Evidence'} 
                  className="w-full h-full object-cover rounded-lg cursor-pointer"
                  onClick={() => setShowPreview(true)}
                />
              ) : evidence.fileData ? (
                <FileText className={cn("w-6 h-6", config.color)} />
              ) : (
                <StatusIcon className={cn("w-6 h-6", config.color)} />
              )}
            </div>
            
            <div className="min-w-0">
              <p className="font-medium truncate">
                {docTypeLabels[evidence.docType] || evidence.docType}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {entityName}
              </p>
            </div>
          </div>

          {/* Status Badge & Actions */}
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn("shrink-0", config.color, config.bgColor, "border-0")}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {evidence.source && (
            <p>Sumber: {evidence.source}</p>
          )}
          {evidence.date && (
            <p>Tanggal: {new Date(evidence.date).toLocaleDateString('id-ID')}</p>
          )}
          {evidence.description && (
            <p className="line-clamp-2">{evidence.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Status Change */}
            <Select value={evidence.status} onValueChange={handleStatusSelect}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="under_review">Dalam Review</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            {evidence.fileData && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Lihat
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{evidence.fileName || 'Preview Dokumen'}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {evidence.fileData && isImage ? (
              <img 
                src={evidence.fileData} 
                alt={evidence.fileName || 'Evidence'} 
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : evidence.fileData ? (
              <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-lg">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="font-medium">{evidence.fileName}</p>
                <p className="text-sm text-muted-foreground">File PDF</p>
                <a 
                  href={evidence.fileData} 
                  download={evidence.fileName}
                  className="mt-4"
                >
                  <Button variant="outline">Download</Button>
                </a>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada file yang di-upload
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <AlertDialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ubah Status Dokumen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(statusConfig[evidence.status].color)}>
                  {statusConfig[evidence.status].label}
                </Badge>
                <ArrowRight className="w-4 h-4" />
                {pendingStatus && (
                  <Badge variant="outline" className={cn(statusConfig[pendingStatus].color)}>
                    {statusConfig[pendingStatus].label}
                  </Badge>
                )}
              </div>
              
              {adjustment && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  adjustment.delta > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {adjustment.delta > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm">
                    Confidence score {adjustment.delta > 0 ? '+' : ''}{adjustment.delta}% ({adjustment.reason})
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Ubah Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen ini akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
