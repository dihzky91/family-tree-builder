import { useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { PersonNode, PlaceholderNode } from '../components/PersonNode';
import { cn } from '@/lib/utils';

interface PedigreeViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent') => void;
  maxGenerations?: number;
}

interface AncestorNode {
  person: Person | null;
  father: AncestorNode | null;
  mother: AncestorNode | null;
}

export function PedigreeView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
  maxGenerations = 4,
}: PedigreeViewProps) {
  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  const ancestorTree = useMemo(() => {
    if (!selectedPerson) return null;

    const buildAncestorTree = (personId: string, depth: number): AncestorNode => {
      const person = persons.find(p => p.id === personId) || null;
      
      if (depth >= maxGenerations || !person) {
        return { person, father: null, mother: null };
      }

      // Find parents
      const parentRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === personId
      );

      let father: AncestorNode | null = null;
      let mother: AncestorNode | null = null;

      parentRels.forEach(rel => {
        const parent = persons.find(p => p.id === rel.fromPersonId);
        if (parent) {
          if (parent.gender === 'male') {
            father = buildAncestorTree(parent.id, depth + 1);
          } else if (parent.gender === 'female') {
            mother = buildAncestorTree(parent.id, depth + 1);
          } else {
            // Unknown gender - assign to first empty slot
            if (!father) {
              father = buildAncestorTree(parent.id, depth + 1);
            } else if (!mother) {
              mother = buildAncestorTree(parent.id, depth + 1);
            }
          }
        }
      });

      return { person, father, mother };
    };

    return buildAncestorTree(selectedPerson.id, 0);
  }, [selectedPerson, persons, relationships, maxGenerations]);

  if (!selectedPerson || !ancestorTree) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <div className="text-center">
          <p className="mb-2">Pilih anggota keluarga untuk melihat Pedigree View</p>
          <p className="text-sm">Tampilan silsilah leluhur dari kiri ke kanan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center p-8 overflow-auto min-h-full">
      <div className="flex items-center gap-2">
        <AncestorColumn 
          node={ancestorTree} 
          generation={0}
          selectedPersonId={selectedPersonId}
          onSelectPerson={onSelectPerson}
          onAddParent={onAddRelationship}
          maxGenerations={maxGenerations}
        />
      </div>
    </div>
  );
}

interface AncestorColumnProps {
  node: AncestorNode;
  generation: number;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddParent?: (personId: string, type: 'parent') => void;
  maxGenerations: number;
}

function AncestorColumn({ 
  node, 
  generation, 
  selectedPersonId,
  onSelectPerson,
  onAddParent,
  maxGenerations
}: AncestorColumnProps) {
  const showParents = generation < maxGenerations - 1;
  const hasAnyParent = node.father || node.mother;
  
  // Calculate the size based on generation (smaller for older generations)
  const size = generation === 0 ? 'large' : generation === 1 ? 'normal' : 'small';

  return (
    <div className="flex items-center gap-2">
      {/* Current person */}
      <div className="flex flex-col items-center justify-center">
        {node.person ? (
          <PersonNode
            person={node.person}
            isSelected={node.person.id === selectedPersonId}
            onClick={() => onSelectPerson(node.person!.id)}
            size={size}
          />
        ) : (
          <PlaceholderNode 
            label="Tambah" 
            onClick={() => {}} 
            size={size}
          />
        )}
        
        {/* Generation label for first column */}
        {generation === 0 && (
          <div className="text-xs text-primary font-semibold mt-2">★ Anda</div>
        )}
      </div>

      {/* Connector line */}
      {showParents && (node.father || node.mother || node.person) && (
        <div className="flex items-center">
          <div className="w-4 h-px bg-border" />
          <div className="w-px bg-border" style={{ height: generation < 2 ? '120px' : '80px' }} />
        </div>
      )}

      {/* Parents column */}
      {showParents && (
        <div className="flex flex-col gap-2 justify-center" style={{ minHeight: generation < 2 ? '120px' : '80px' }}>
          {/* Father branch */}
          <div className="flex items-center">
            <div className="w-4 h-px bg-border" />
            {node.father ? (
              <AncestorColumn
                node={node.father}
                generation={generation + 1}
                selectedPersonId={selectedPersonId}
                onSelectPerson={onSelectPerson}
                onAddParent={onAddParent}
                maxGenerations={maxGenerations}
              />
            ) : node.person ? (
              <PlaceholderNode 
                label="+ Ayah" 
                onClick={() => onAddParent?.(node.person!.id, 'parent')} 
                size={generation < 2 ? 'normal' : 'small'}
              />
            ) : null}
          </div>

          {/* Mother branch */}
          <div className="flex items-center">
            <div className="w-4 h-px bg-border" />
            {node.mother ? (
              <AncestorColumn
                node={node.mother}
                generation={generation + 1}
                selectedPersonId={selectedPersonId}
                onSelectPerson={onSelectPerson}
                onAddParent={onAddParent}
                maxGenerations={maxGenerations}
              />
            ) : node.person ? (
              <PlaceholderNode 
                label="+ Ibu" 
                onClick={() => onAddParent?.(node.person!.id, 'parent')} 
                size={generation < 2 ? 'normal' : 'small'}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
