import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Relationship, Person } from '@/types';
import { getRelationshipDisplayInfo } from '@/lib/relationshipValidation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { RelationshipForm } from './RelationshipForm';
import { 
  Edit, 
  Trash2, 
  Calendar, 
  FileText, 
  Users,
  Heart,
  ArrowRight
} from 'lucide-react';

interface RelationshipInspectorProps {
  personId: string;
  onPersonClick?: (personId: string) => void;
}

export function RelationshipInspector({ personId, onPersonClick }: RelationshipInspectorProps) {
  const { relationships, persons, evidence, deleteRelationship } = useFamilyStore();
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
  const [deletingRelationship, setDeletingRelationship] = useState<Relationship | null>(null);

  // Get all relationships for this person
  const personRelationships = relationships.filter(
    r => r.fromPersonId === personId || r.toPersonId === personId
  );

  const parentChildRels = personRelationships.filter(r => r.type === 'PARENT_CHILD');
  const spouseRels = personRelationships.filter(r => r.type === 'SPOUSE');

  const handleDelete = async () => {
    if (deletingRelationship) {
      await deleteRelationship(deletingRelationship.id);
      setDeletingRelationship(null);
    }
  };

  const getRelatedEvidence = (relationshipId: string) => {
    return evidence.filter(
      e => e.entityType === 'RELATIONSHIP' && e.entityId === relationshipId
    );
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (personRelationships.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Belum ada relasi yang tercatat
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Parent-Child Relationships */}
      {parentChildRels.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Relasi Keluarga
          </h4>
          <div className="space-y-2">
            {parentChildRels.map(rel => {
              const info = getRelationshipDisplayInfo(rel, personId, persons);
              const relEvidence = getRelatedEvidence(rel.id);
              
              return (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  info={info}
                  evidence={relEvidence}
                  onEdit={() => setEditingRelationship(rel)}
                  onDelete={() => setDeletingRelationship(rel)}
                  onPersonClick={onPersonClick}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Spouse Relationships */}
      {spouseRels.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Pasangan
          </h4>
          <div className="space-y-2">
            {spouseRels.map(rel => {
              const info = getRelationshipDisplayInfo(rel, personId, persons);
              const relEvidence = getRelatedEvidence(rel.id);
              
              return (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  info={info}
                  evidence={relEvidence}
                  onEdit={() => setEditingRelationship(rel)}
                  onDelete={() => setDeletingRelationship(rel)}
                  onPersonClick={onPersonClick}
                  showDates
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRelationship} onOpenChange={() => setEditingRelationship(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Relasi</DialogTitle>
            <DialogDescription>
              Ubah informasi relasi ini
            </DialogDescription>
          </DialogHeader>
          {editingRelationship && (
            <RelationshipForm
              editingRelationship={editingRelationship}
              onSuccess={() => setEditingRelationship(null)}
              onCancel={() => setEditingRelationship(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRelationship} onOpenChange={() => setDeletingRelationship(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Relasi?</AlertDialogTitle>
            <AlertDialogDescription>
              Relasi ini akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RelationshipCardProps {
  relationship: Relationship;
  info: { label: string; icon: string; person: Person | undefined };
  evidence: any[];
  onEdit: () => void;
  onDelete: () => void;
  onPersonClick?: (personId: string) => void;
  showDates?: boolean;
}

function RelationshipCard({ 
  relationship, 
  info, 
  evidence, 
  onEdit, 
  onDelete,
  onPersonClick,
  showDates 
}: RelationshipCardProps) {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    married: { label: 'Menikah', variant: 'default' },
    divorced: { label: 'Cerai', variant: 'destructive' },
    partner: { label: 'Pasangan', variant: 'secondary' },
    unknown: { label: 'Status?', variant: 'outline' },
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Relationship label & person */}
          <div className="flex items-center gap-2 text-sm">
            <span>{info.icon}</span>
            <span className="text-muted-foreground">{info.label}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            {info.person && (
              <button
                onClick={() => onPersonClick?.(info.person!.id)}
                className="font-medium hover:text-primary transition-colors truncate"
              >
                {info.person.fullName}
              </button>
            )}
          </div>

          {/* Spouse status & dates */}
          {showDates && relationship.type === 'SPOUSE' && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {relationship.meta?.status && (
                <Badge variant={statusLabels[relationship.meta.status]?.variant || 'outline'} className="text-xs">
                  {statusLabels[relationship.meta.status]?.label || relationship.meta.status}
                </Badge>
              )}
              {relationship.meta?.startDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(relationship.meta.startDate)}
                </span>
              )}
              {relationship.meta?.endDate && (
                <span className="text-xs text-muted-foreground">
                  → {formatDate(relationship.meta.endDate)}
                </span>
              )}
            </div>
          )}

          {/* Evidence count */}
          {evidence.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <FileText className="w-3 h-3" />
              {evidence.length} dokumen terkait
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
