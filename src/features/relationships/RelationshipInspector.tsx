import { useState, useMemo } from 'react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

interface GroupedParentRelationship {
  type: 'single' | 'combined';
  relationships: Relationship[];
  parents: Person[];
}

interface GroupedChildRelationship {
  relationships: Relationship[];
  children: Person[];
}

export function RelationshipInspector({ personId, onPersonClick }: RelationshipInspectorProps) {
  const { relationships, persons, evidence, deleteRelationship } = useFamilyStore();
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
  const [deletingRelationship, setDeletingRelationship] = useState<Relationship | null>(null);
  const [deletingRelationships, setDeletingRelationships] = useState<Relationship[] | null>(null);

  // Get all relationships for this person
  const personRelationships = relationships.filter(
    r => r.fromPersonId === personId || r.toPersonId === personId
  );

  const parentChildRels = personRelationships.filter(r => r.type === 'PARENT_CHILD');
  const spouseRels = personRelationships.filter(r => r.type === 'SPOUSE');

  // Helper function to check if two people are spouses
  const areSpouses = (person1Id: string, person2Id: string) => {
    return relationships.some(
      r => r.type === 'SPOUSE' && 
      ((r.fromPersonId === person1Id && r.toPersonId === person2Id) ||
       (r.fromPersonId === person2Id && r.toPersonId === person1Id))
    );
  };

  // Group parent-child relationships
  const { groupedAsParent, groupedAsChild } = useMemo(() => {
    const asParentRels = parentChildRels.filter(r => r.fromPersonId === personId);
    const asChildRels = parentChildRels.filter(r => r.toPersonId === personId);
    
    // Group "As Child" - combine parents who are spouses
    const groupedAsChild: GroupedParentRelationship[] = [];
    const processedChildIds = new Set<string>();
    
    for (const rel of asChildRels) {
      if (processedChildIds.has(rel.id)) continue;
      
      const parentId = rel.fromPersonId;
      
      // Find if there's another parent who is a spouse of this parent
      const otherParentRel = asChildRels.find(r => 
        r.id !== rel.id && 
        !processedChildIds.has(r.id) && 
        areSpouses(parentId, r.fromPersonId)
      );
      
      if (otherParentRel) {
        // Combine both relationships
        const parent1 = persons.find(p => p.id === rel.fromPersonId);
        const parent2 = persons.find(p => p.id === otherParentRel.fromPersonId);
        groupedAsChild.push({
          type: 'combined',
          relationships: [rel, otherParentRel],
          parents: [parent1, parent2].filter((p): p is Person => !!p)
        });
        processedChildIds.add(rel.id);
        processedChildIds.add(otherParentRel.id);
      } else {
        // Show as single
        const parent = persons.find(p => p.id === rel.fromPersonId);
        groupedAsChild.push({
          type: 'single',
          relationships: [rel],
          parents: parent ? [parent] : []
        });
        processedChildIds.add(rel.id);
      }
    }

    // Group "As Parent" - combine all children into one entry
    const groupedAsParent: GroupedChildRelationship | null = asParentRels.length > 0 ? {
      relationships: asParentRels,
      children: asParentRels
        .map(r => persons.find(p => p.id === r.toPersonId))
        .filter((p): p is Person => !!p)
    } : null;
    
    return { groupedAsParent, groupedAsChild };
  }, [parentChildRels, personId, persons, relationships]);

  const handleDelete = async () => {
    if (deletingRelationship) {
      await deleteRelationship(deletingRelationship.id);
      setDeletingRelationship(null);
    }
  };

  const handleDeleteMultiple = async () => {
    if (deletingRelationships) {
      for (const rel of deletingRelationships) {
        await deleteRelationship(rel.id);
      }
      setDeletingRelationships(null);
    }
  };

  const getRelatedEvidence = (relationshipId: string) => {
    return evidence.filter(
      e => e.entityType === 'RELATIONSHIP' && e.entityId === relationshipId
    );
  };

  const getGroupedEvidence = (rels: Relationship[]) => {
    return evidence.filter(
      e => e.entityType === 'RELATIONSHIP' && rels.some(r => r.id === e.entityId)
    );
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
      {(groupedAsChild.length > 0 || groupedAsParent) && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Relasi Keluarga
          </h4>
          <div className="space-y-2">
            {/* As Child - Grouped */}
            {groupedAsChild.map((group, idx) => (
              group.type === 'combined' ? (
                <CombinedParentCard
                  key={`combined-${idx}`}
                  parents={group.parents}
                  relationships={group.relationships}
                  evidence={getGroupedEvidence(group.relationships)}
                  onPersonClick={onPersonClick}
                  onEditRelationship={(rel) => setEditingRelationship(rel)}
                  onDeleteRelationships={(rels) => setDeletingRelationships(rels)}
                />
              ) : (
                <RelationshipCard
                  key={group.relationships[0].id}
                  relationship={group.relationships[0]}
                  info={getRelationshipDisplayInfo(group.relationships[0], personId, persons)}
                  evidence={getRelatedEvidence(group.relationships[0].id)}
                  onEdit={() => setEditingRelationship(group.relationships[0])}
                  onDelete={() => setDeletingRelationship(group.relationships[0])}
                  onPersonClick={onPersonClick}
                />
              )
            ))}

            {/* As Parent - Grouped children */}
            {groupedAsParent && (
              <CombinedChildCard
                children={groupedAsParent.children}
                relationships={groupedAsParent.relationships}
                evidence={getGroupedEvidence(groupedAsParent.relationships)}
                onPersonClick={onPersonClick}
                onEditRelationship={(rel) => setEditingRelationship(rel)}
                onDeleteRelationships={(rels) => setDeletingRelationships(rels)}
              />
            )}
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

      {/* Delete Confirmation - Single */}
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

      {/* Delete Confirmation - Multiple Relationships */}
      <AlertDialog open={!!deletingRelationships} onOpenChange={() => setDeletingRelationships(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingRelationships?.length === 1 
                ? 'Hapus Relasi?' 
                : deletingRelationships?.length === 2 
                  ? 'Hapus Kedua Relasi?' 
                  : `Hapus ${deletingRelationships?.length} Relasi?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRelationships?.length === 1 
                ? 'Relasi ini akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.'
                : deletingRelationships?.length === 2
                  ? 'Kedua relasi akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.'
                  : `Semua ${deletingRelationships?.length} relasi akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMultiple} className="bg-destructive text-destructive-foreground">
              {deletingRelationships?.length === 1 
                ? 'Hapus' 
                : deletingRelationships?.length === 2 
                  ? 'Hapus Keduanya' 
                  : `Hapus Semua (${deletingRelationships?.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Combined Parent Card for married parents
interface CombinedParentCardProps {
  parents: Person[];
  relationships: Relationship[];
  evidence: any[];
  onPersonClick?: (personId: string) => void;
  onEditRelationship?: (relationship: Relationship) => void;
  onDeleteRelationships?: (relationships: Relationship[]) => void;
}

function CombinedParentCard({ 
  parents, 
  relationships,
  evidence, 
  onPersonClick,
  onEditRelationship,
  onDeleteRelationships
}: CombinedParentCardProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span>👨‍👩‍👧</span>
            <span className="text-muted-foreground">Anak dari</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            
            {parents[0] && (
              <button
                onClick={() => onPersonClick?.(parents[0].id)}
                className="font-medium hover:text-primary transition-colors"
              >
                {parents[0].fullName}
              </button>
            )}
            
            {parents[1] && (
              <>
                <span className="text-muted-foreground">&</span>
                <button
                  onClick={() => onPersonClick?.(parents[1].id)}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {parents[1].fullName}
                </button>
              </>
            )}
          </div>

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
          {/* Edit - Popover to choose which relationship */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2 px-2">
                  Pilih relasi yang ingin diedit:
                </p>
                {relationships.map((rel, idx) => (
                  <Button
                    key={rel.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => onEditRelationship?.(rel)}
                  >
                    Relasi ke {parents[idx]?.fullName}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Delete - Delete both relationships */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDeleteRelationships?.(relationships)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Combined Child Card for multiple children
interface CombinedChildCardProps {
  children: Person[];
  relationships: Relationship[];
  evidence: any[];
  onPersonClick?: (personId: string) => void;
  onEditRelationship?: (relationship: Relationship) => void;
  onDeleteRelationships?: (relationships: Relationship[]) => void;
}

function CombinedChildCard({ 
  children: childrenList,
  relationships,
  evidence, 
  onPersonClick,
  onEditRelationship,
  onDeleteRelationships
}: CombinedChildCardProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span>👶</span>
            <span className="text-muted-foreground">Orang tua dari</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {childrenList.length}
            </Badge>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            
            {childrenList.map((child, idx) => (
              <span key={child.id} className="inline-flex items-center">
                {idx > 0 && (
                  <span className="text-muted-foreground mr-2">
                    {idx === childrenList.length - 1 ? '&' : ','}
                  </span>
                )}
                <button
                  onClick={() => onPersonClick?.(child.id)}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {child.fullName}
                  {child.birthDate && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({new Date(child.birthDate).getFullYear()})
                    </span>
                  )}
                </button>
              </span>
            ))}
          </div>

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
          {/* Edit - Popover to choose which relationship */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2 px-2">
                  Pilih relasi yang ingin diedit:
                </p>
                {relationships.map((rel, idx) => (
                  <Button
                    key={rel.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => onEditRelationship?.(rel)}
                  >
                    Relasi ke {childrenList[idx]?.fullName}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Delete - Delete all relationships */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDeleteRelationships?.(relationships)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
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