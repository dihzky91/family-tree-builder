import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
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
  Plus, 
  FileText, 
  CheckCircle,
  Clock,
  XCircle,
  File,
  RefreshCw
} from 'lucide-react';
import { EvidenceForm } from '@/features/evidence/EvidenceForm';
import { EvidenceCard } from '@/features/evidence/EvidenceCard';
import type { Evidence, VerificationStatus } from '@/types';
import { recalculatePersonConfidence } from '@/lib/confidenceScore';

const statusConfig: Record<VerificationStatus, { icon: typeof CheckCircle; label: string }> = {
  draft: { icon: File, label: 'Draft' },
  under_review: { icon: Clock, label: 'Dalam Review' },
  verified: { icon: CheckCircle, label: 'Terverifikasi' },
  rejected: { icon: XCircle, label: 'Ditolak' },
};

export default function EvidencePage() {
  const { evidence, persons, relationships, deleteEvidence, updateEvidence, updatePerson } = useFamilyStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
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

  const handleStatusChange = async (ev: Evidence, newStatus: VerificationStatus) => {
    await updateEvidence(ev.id, { status: newStatus });
    
    // Auto-adjust confidence score for person entities
    if (ev.entityType === 'PERSON') {
      const person = persons.find(p => p.id === ev.entityId);
      if (person) {
        // Update the evidence list with new status for calculation
        const updatedEvidence = evidence.map(e => 
          e.id === ev.id ? { ...e, status: newStatus } : e
        );
        await recalculatePersonConfidence(
          ev.entityId, 
          updatedEvidence, 
          updatePerson,
          person.confidenceScore
        );
      }
    }
  };

  const handleDelete = async (ev: Evidence) => {
    await deleteEvidence(ev.id);
    
    // Recalculate confidence after deletion
    if (ev.entityType === 'PERSON') {
      const person = persons.find(p => p.id === ev.entityId);
      if (person) {
        const remainingEvidence = evidence.filter(e => e.id !== ev.id);
        await recalculatePersonConfidence(
          ev.entityId,
          remainingEvidence,
          updatePerson,
          person.confidenceScore
        );
      }
    }
  };

  // Count by status
  const statusCounts = {
    all: evidence.length,
    draft: evidence.filter(e => e.status === 'draft').length,
    under_review: evidence.filter(e => e.status === 'under_review').length,
    verified: evidence.filter(e => e.status === 'verified').length,
    rejected: evidence.filter(e => e.status === 'rejected').length,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            Dokumen & Bukti
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola dokumen pendukung untuk verifikasi data
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Tambah Dokumen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Tambah Dokumen Baru</DialogTitle>
            </DialogHeader>
            <EvidenceForm onSuccess={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Tabs - horizontally scrollable on mobile */}
      <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-2 pb-0.5">
        {(['all', 'draft', 'under_review', 'verified', 'rejected'] as const).map((status) => {
          const config = status === 'all' 
            ? { icon: FileText, label: 'Semua' }
            : statusConfig[status];
          const Icon = config.icon;
          const isActive = filterStatus === status;
          
          return (
            <Button
              key={status}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="gap-1.5 shrink-0 rounded-xl"
            >
              <Icon className="w-4 h-4" />
              {config.label}
              <Badge 
                variant={isActive ? 'secondary' : 'outline'} 
                className="ml-1 h-5 px-1.5"
              >
                {statusCounts[status]}
              </Badge>
            </Button>
          );
        })}
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
          {filteredEvidence.map((ev) => (
            <EvidenceCard
              key={ev.id}
              evidence={ev}
              entityName={getEntityName(ev)}
              onStatusChange={(newStatus) => handleStatusChange(ev, newStatus)}
              onDelete={() => handleDelete(ev)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
