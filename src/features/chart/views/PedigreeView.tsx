import { memo, useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { PersonNode, PlaceholderNode } from '../components/PersonNode';
import { cn } from '@/lib/utils';

function getYearLabel(date?: string) {
  return date ? `${new Date(date).getFullYear()}` : 'Tahun tidak diketahui';
}

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

export const PedigreeView = memo(function PedigreeView({
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

    const personById = new globalThis.Map(persons.map((person) => [person.id, person]));
    const parentsByChild = new globalThis.Map<string, Person[]>();

    relationships.forEach((relationship) => {
      if (relationship.type !== 'PARENT_CHILD') return;

      const parent = personById.get(relationship.fromPersonId);
      if (!parent) return;

      const currentParents = parentsByChild.get(relationship.toPersonId);
      if (currentParents) {
        currentParents.push(parent);
      } else {
        parentsByChild.set(relationship.toPersonId, [parent]);
      }
    });

    const treeCache = new globalThis.Map<string, AncestorNode>();

    const buildAncestorTree = (personId: string, depth: number): AncestorNode => {
      const person = personById.get(personId) || null;

      if (depth >= maxGenerations || !person) {
        return { person, father: null, mother: null };
      }

      const cacheKey = `${personId}:${depth}`;
      const cachedTree = treeCache.get(cacheKey);
      if (cachedTree) return cachedTree;

      const parentCandidates = parentsByChild.get(personId) || [];

      let father: AncestorNode | null = null;
      let mother: AncestorNode | null = null;

      parentCandidates.forEach((parent) => {
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
      });

      const node = { person, father, mother };
      treeCache.set(cacheKey, node);
      return node;
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
    <div className="mx-auto flex min-h-full w-full max-w-[1700px] flex-col gap-6 px-6 py-8">
      <section className="rounded-[28px] border border-border/60 bg-background/88 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Jalur leluhur</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Pedigree {selectedPerson.fullName}</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Baca alur dari kiri ke kanan. Jalur ayah berada di bagian atas, jalur ibu di bagian bawah, dan slot kosong menandai leluhur yang belum tercatat.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">Kedalaman {maxGenerations} generasi</span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">Lahir {getYearLabel(selectedPerson.birthDate)}</span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">Fokus aktif</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Subjek utama</p>
            <p className="mt-2 text-sm font-medium text-foreground">{selectedPerson.fullName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Node awal yang menjadi pusat seluruh pembacaan pedigree.</p>
          </div>
          <div className="rounded-2xl border border-node-male/40 bg-node-male/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-node-male">Cabang ayah</p>
            <p className="mt-2 text-sm text-foreground">Muncul di lane atas dengan konektor bernuansa biru.</p>
          </div>
          <div className="rounded-2xl border border-node-female/40 bg-node-female/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-node-female">Cabang ibu</p>
            <p className="mt-2 text-sm text-foreground">Muncul di lane bawah dengan konektor bernuansa merah muda.</p>
          </div>
        </div>
      </section>

      <section className="overflow-auto rounded-[30px] border border-border/60 bg-background/80 p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/60 pb-4 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">Lane atas: garis ayah</span>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">Lane bawah: garis ibu</span>
        </div>
        <div className="flex items-center">
          <PedigreeColumn
            node={ancestorTree}
            generation={0}
            selectedPersonId={selectedPersonId}
            onSelectPerson={onSelectPerson}
            onAddParent={onAddRelationship}
            maxGenerations={maxGenerations}
          />
        </div>
      </section>
    </div>
  );
});

PedigreeView.displayName = 'PedigreeView';

interface PedigreeColumnProps {
  node: AncestorNode;
  generation: number;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddParent?: (personId: string, type: 'parent') => void;
  maxGenerations: number;
}

const PedigreeColumn = memo(function PedigreeColumn({
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
      <div className="flex min-w-[180px] flex-col items-center justify-center" style={{ minHeight: `${totalHeight}px` }}>
        {node.person && (
          <div
            className={cn(
              'mb-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]',
              generation === 0
                ? 'border-primary/40 bg-primary/10 text-primary'
                : generation % 2 === 0
                  ? 'border-node-female/30 bg-node-female/10 text-node-female'
                  : 'border-node-male/30 bg-node-male/10 text-node-male'
            )}
          >
            {generation === 0 ? 'Subjek' : `Generasi +${generation}`}
          </div>
        )}
        {node.person ? (
          <PersonNode
            person={node.person}
            isSelected={node.person.id === selectedPersonId}
            onClick={() => onSelectPerson(node.person!.id)}
            size={size}
            reduceMotion
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
              stroke={node.father ? 'hsl(var(--node-male))' : 'hsl(var(--border))'}
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
              stroke={node.mother ? 'hsl(var(--node-female))' : 'hsl(var(--border))'}
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
});

PedigreeColumn.displayName = 'PedigreeColumn';
