import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Plus, 
  FileText, 
  Trash2, 
  CheckCircle,
  Clock,
  XCircle,
  File,
  User,
  Link2
} from 'lucide-react';
import { EvidenceForm } from '@/features/evidence/EvidenceForm';
import type { Evidence, VerificationStatus } from '@/types';

const statusIcons: Record<VerificationStatus, typeof CheckCircle> = {
  verified: CheckCircle,
  under_review: Clock,
  draft: File,
  rejected: XCircle,
};

const statusColors: Record<VerificationStatus, string> = {
  verified: 'badge-verified',
  under_review: 'badge-review',
  draft: 'badge-draft',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function EvidencePage() {
  const { evidence, persons, relationships, deleteEvidence } = useFamilyStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Evidence | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredEvidence = filterStatus === 'all' 
    ? evidence 
    : evidence.filter(e => e.status === filterStatus);

  const getEntityName = (ev: Evidence) => {
    if (ev.entityType === 'PERSON') {
      const person = persons.find(p => p.id === ev.entityId);
      return person?.fullName || 'Unknown Person';
    } else {
      const rel = relationships.find(r => r.id === ev.entityId);
      if (rel) {
        const from = persons.find(p => p.id === rel.fromPersonId);
        const to = persons.find(p => p.id === rel.toPersonId);
        return `${from?.fullName || '?'} → ${to?.fullName || '?'}`;
      }
      return 'Unknown Relationship';
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteEvidence(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const docTypeLabels: Record<string, string> = {
    birth_certificate: 'Akta Lahir',
    family_card: 'Kartu Keluarga',
    marriage_certificate: 'Surat Nikah',
    death_certificate: 'Akta Kematian',
    photo: 'Foto',
    other: 'Lainnya',
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Dokumen & Bukti
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola dokumen pendukung untuk verifikasi data
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Dokumen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">Tambah Dokumen Baru</DialogTitle>
            </DialogHeader>
            <EvidenceForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter status:</span>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="verified">Terverifikasi</SelectItem>
            <SelectItem value="under_review">Dalam Review</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Evidence Grid */}
      {filteredEvidence.length === 0 ? (
        <div className="empty-state py-20">
          <FileText className="empty-state-icon" />
          <h3 className="text-lg font-medium mb-2">
            {filterStatus !== 'all' ? 'Tidak ada dokumen' : 'Belum ada dokumen'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {filterStatus !== 'all' 
              ? 'Coba filter lain atau tambah dokumen baru'
              : 'Mulai dengan menambahkan dokumen pendukung'}
          </p>
          {filterStatus === 'all' && (
            <Button onClick={() => setIsAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Dokumen Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEvidence.map((ev) => {
            const StatusIcon = statusIcons[ev.status];
            return (
              <Card key={ev.id} className="p-4 hover:shadow-lg transition-shadow animate-slide-up">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{docTypeLabels[ev.docType] || ev.docType}</p>
                      <Badge variant="outline" className={statusColors[ev.status]}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {ev.status}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => setDeleteConfirm(ev)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Linked Entity */}
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  {ev.entityType === 'PERSON' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  <span className="truncate">{getEntityName(ev)}</span>
                </div>

                {/* Details */}
                {(ev.source || ev.date) && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {ev.source && <p>Sumber: {ev.source}</p>}
                    {ev.date && <p>Tanggal: {new Date(ev.date).toLocaleDateString('id-ID')}</p>}
                  </div>
                )}

                {ev.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2 border-t pt-2">
                    {ev.description}
                  </p>
                )}

                <p className="mt-2 text-xs text-muted-foreground">
                  Ditambahkan: {new Date(ev.createdAt).toLocaleDateString('id-ID')}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dokumen?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus dokumen ini. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
