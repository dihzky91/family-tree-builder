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

const getBaseRowHeight = (generation: number) => {
  if (generation === 0) return 160;
  if (generation === 1) return 130;
  return 110;
};

const getSubtreeHeight = (
  node: AncestorNode,
  generation: number,
  maxGenerations: number
): number => {
  const baseRowHeight = getBaseRowHeight(generation);

  if (generation >= maxGenerations - 1) {
    return baseRowHeight * 2;
  }

  const fatherHeight = node.father
    ? getSubtreeHeight(node.father, generation + 1, maxGenerations)
    : baseRowHeight;
  const motherHeight = node.mother
    ? getSubtreeHeight(node.mother, generation + 1, maxGenerations)
    : baseRowHeight;

  return Math.max(baseRowHeight * 2, fatherHeight + motherHeight);
};

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
      <PedigreeColumn
        node={ancestorTree}
        generation={0}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        onAddParent={onAddRelationship}
        maxGenerations={maxGenerations}
      />
    </div>
  );
}

interface PedigreeColumnProps {
  node: AncestorNode;
  generation: number;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddParent?: (personId: string, type: 'parent') => void;
  maxGenerations: number;
}

function PedigreeColumn({
  node,
  generation,
  selectedPersonId,
  onSelectPerson,
  onAddParent,
  maxGenerations
}: PedigreeColumnProps) {
  const showParents = generation < maxGenerations - 1;
  const hasAnyParent = node.father || node.mother;


  // Size decreases with each generation
  const size = generation === 0 ? 'large' : generation === 1 ? 'normal' : 'small';

  // Heights for SVG connectors - increased for better spacing
  // Each person needs space for their own parents
  const baseRowHeight = getBaseRowHeight(generation);
  const totalHeight = showParents
    ? getSubtreeHeight(node, generation, maxGenerations)
    : baseRowHeight * 2;
  const fatherHeight = showParents
    ? (node.father ? getSubtreeHeight(node.father, generation + 1, maxGenerations) : baseRowHeight)
    : 0;
  const motherHeight = showParents
    ? (node.mother ? getSubtreeHeight(node.mother, generation + 1, maxGenerations) : baseRowHeight)
    : 0;
  const centerY = totalHeight / 2;
  const fatherCenterY = fatherHeight / 2;
  const motherCenterY = fatherHeight + motherHeight / 2;
  const connectorWidth = generation === 0 ? 48 : generation === 1 ? 40 : 32;

  return (
    <div className="flex items-center">
      {/* Current person column */}
      <div className="flex flex-col items-center justify-center" style={{ minHeight: `${totalHeight}px` }}>
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
            onClick={() => { }}
            size={size}
          />
        )}

        {generation === 0 && (
          <div className="text-xs text-primary font-semibold mt-2 flex items-center gap-1">
            <span className="text-accent">★</span> Anda
          </div>
        )}
      </div>

      {/* SVG Connector to parents */}
      {showParents && node.person && (
        <svg
          className="shrink-0"
          width={connectorWidth}
          height={totalHeight}
          viewBox={`0 0 ${connectorWidth} ${totalHeight}`}
        >
          <defs>
            <linearGradient id={`pedigreeGrad${generation}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--border))" />
              <stop offset="100%" stopColor="hsl(var(--border))" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Main horizontal line from person */}
          <path
            d={`M 0 ${centerY} L ${connectorWidth * 0.3} ${centerY}`}
            stroke={`url(#pedigreeGrad${generation})`}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Vertical bracket */}
          {(node.father || node.mother) && (
            <path
              d={`M ${connectorWidth * 0.3} ${fatherCenterY} 
                  L ${connectorWidth * 0.3} ${motherCenterY}`}
              stroke="hsl(var(--border))"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Curved branch to father (top) */}
          {(node.father || node.person) && (
            <path
              d={`M ${connectorWidth * 0.3} ${fatherCenterY} 
                  Q ${connectorWidth * 0.5} ${fatherCenterY}, 
                    ${connectorWidth * 0.7} ${fatherCenterY}
                  L ${connectorWidth} ${fatherCenterY}`}
              stroke={node.father ? "hsl(var(--node-male))" : "hsl(var(--border))"}
              strokeWidth="2"
              strokeDasharray={node.father ? "none" : "4 3"}
              fill="none"
              strokeLinecap="round"
              opacity={node.father ? 1 : 0.4}
              className="transition-all duration-300"
            />
          )}

          {/* Curved branch to mother (bottom) */}
          {(node.mother || node.person) && (
            <path
              d={`M ${connectorWidth * 0.3} ${motherCenterY} 
                  Q ${connectorWidth * 0.5} ${motherCenterY}, 
                    ${connectorWidth * 0.7} ${motherCenterY}
                  L ${connectorWidth} ${motherCenterY}`}
              stroke={node.mother ? "hsl(var(--node-female))" : "hsl(var(--border))"}
              strokeWidth="2"
              strokeDasharray={node.mother ? "none" : "4 3"}
              fill="none"
              strokeLinecap="round"
              opacity={node.mother ? 1 : 0.4}
              className="transition-all duration-300"
            />
          )}

          {/* Connection dots */}
          {node.father && (
            <circle
              cx={connectorWidth * 0.3}
              cy={fatherCenterY}
              r="3"
              fill="hsl(var(--node-male))"
              className="animate-scale-in"
            />
          )}
          {node.mother && (
            <circle
              cx={connectorWidth * 0.3}
              cy={motherCenterY}
              r="3"
              fill="hsl(var(--node-female))"
              className="animate-scale-in"
            />
          )}
        </svg>
      )}

      {/* Parents column */}
      {showParents && (
        <div className="flex flex-col" style={{ height: `${totalHeight}px` }}>
          {/* Father branch - top half */}
          <div className="flex items-center justify-center" style={{ height: `${fatherHeight}px` }}>
            {node.father ? (
              <PedigreeColumn
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

          {/* Mother branch - bottom half */}
          <div className="flex items-center justify-center" style={{ height: `${motherHeight}px` }}>
            {node.mother ? (
              <PedigreeColumn
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
