import { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Heart,
  Crown,
  Search,
  Users,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Person, Relationship } from '@/types';

interface DescendantOutlineViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

interface OutlineNode {
  person: Person;
  spouses: Person[];
  children: OutlineNode[];
  generation: number; // 1 = root sesepuh
  numbering: string; // e.g., "1", "1.1", "1.1.2"
  totalDescendants: number;
}

function extractYear(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatLife(p: Person): string | null {
  const b = extractYear(p.birthDate);
  const d = extractYear(p.deathDate);
  if (b && d) return `${b}–${d}`;
  if (b) return `l. ${b}`;
  if (d) return `w. ${d}`;
  return null;
}

export function DescendantOutlineView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: DescendantOutlineViewProps) {
  const [rootPersonId, setRootPersonId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  // Build adjacency maps
  const maps = useMemo(() => {
    const personMap = new Map<string, Person>();
    persons.forEach((p) => personMap.set(p.id, p));

    const parentsOf = new Map<string, string[]>();
    const childrenOf = new Map<string, Person[]>();
    const spousesOf = new Map<string, Person[]>();

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        const child = personMap.get(r.toPersonId);
        if (!parentsOf.has(r.toPersonId)) parentsOf.set(r.toPersonId, []);
        parentsOf.get(r.toPersonId)!.push(r.fromPersonId);

        if (child) {
          if (!childrenOf.has(r.fromPersonId)) childrenOf.set(r.fromPersonId, []);
          if (!childrenOf.get(r.fromPersonId)!.some((c) => c.id === child.id)) {
            childrenOf.get(r.fromPersonId)!.push(child);
          }
        }
      } else if (r.type === 'SPOUSE') {
        const a = personMap.get(r.fromPersonId);
        const b = personMap.get(r.toPersonId);
        if (a && b) {
          if (!spousesOf.has(a.id)) spousesOf.set(a.id, []);
          if (!spousesOf.get(a.id)!.some((s) => s.id === b.id)) spousesOf.get(a.id)!.push(b);
          if (!spousesOf.has(b.id)) spousesOf.set(b.id, []);
          if (!spousesOf.get(b.id)!.some((s) => s.id === a.id)) spousesOf.get(b.id)!.push(a);
        }
      }
    });

    childrenOf.forEach((list) => {
      list.sort((a, b) => {
        const ya = a.birthDate ? new Date(a.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
        const yb = b.birthDate ? new Date(b.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ya - yb;
      });
    });

    return { personMap, parentsOf, childrenOf, spousesOf };
  }, [persons, relationships]);

  // Smart default root: oldest patriarch/matriarch (no parents, most descendants)
  useEffect(() => {
    if (rootPersonId && persons.some((p) => p.id === rootPersonId)) return;
    if (persons.length === 0) return;

    const countDescendants = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const kids = maps.childrenOf.get(id) || [];
      return kids.reduce((acc, c) => acc + 1 + countDescendants(c.id, visited), 0);
    };

    const roots = persons.filter((p) => (maps.parentsOf.get(p.id) || []).length === 0);
    const pool = roots.length > 0 ? roots : persons;

    const best = [...pool].sort((a, b) => {
      const diff = countDescendants(b.id) - countDescendants(a.id);
      if (diff !== 0) return diff;
      const ya = a.birthDate ? new Date(a.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
      const yb = b.birthDate ? new Date(b.birthDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ya - yb;
    })[0];

    setRootPersonId(best?.id ?? null);
  }, [persons, maps, rootPersonId]);

  // Build hierarchical outline tree
  const outlineTree = useMemo<OutlineNode | null>(() => {
    if (!rootPersonId) return null;
    const root = maps.personMap.get(rootPersonId);
    if (!root) return null;

    const buildNode = (
      person: Person,
      generation: number,
      numbering: string,
      visited: Set<string>
    ): OutlineNode => {
      const nextVisited = new Set(visited);
      nextVisited.add(person.id);

      const kids = (maps.childrenOf.get(person.id) || []).filter(
        (c) => !nextVisited.has(c.id)
      );

      const childNodes = kids.map((kid, idx) =>
        buildNode(kid, generation + 1, `${numbering}.${idx + 1}`, nextVisited)
      );

      const totalDescendants = childNodes.reduce(
        (acc, c) => acc + 1 + c.totalDescendants,
        0
      );

      return {
        person,
        spouses: maps.spousesOf.get(person.id) || [],
        children: childNodes,
        generation,
        numbering,
        totalDescendants,
      };
    };

    return buildNode(root, 1, '1', new Set());
  }, [rootPersonId, maps]);

  // Collect all expandable IDs
  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (node: OutlineNode | null) => {
      if (!node) return;
      if (node.children.length > 0) ids.push(node.person.id);
      node.children.forEach(walk);
    };
    walk(outlineTree);
    return ids;
  }, [outlineTree]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => {
    // Keep root open so first generation is visible
    const ids = allExpandableIds.filter((id) => id !== rootPersonId);
    setCollapsedIds(new Set(ids));
  };

  const normalizedQuery = filterText.trim().toLowerCase();

  const matchesFilter = (node: OutlineNode): boolean => {
    if (!normalizedQuery) return true;
    if (node.person.fullName.toLowerCase().includes(normalizedQuery)) return true;
    if (node.spouses.some((s) => s.fullName.toLowerCase().includes(normalizedQuery))) return true;
    return node.children.some(matchesFilter);
  };

  const renderNode = (node: OutlineNode, isRoot = false) => {
    if (!matchesFilter(node)) return null;

    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedIds.has(node.person.id) && !normalizedQuery;
    const isSelected = selectedPersonId === node.person.id;
    const life = formatLife(node.person);
    const isDirectMatch =
      normalizedQuery.length > 0 &&
      (node.person.fullName.toLowerCase().includes(normalizedQuery) ||
        node.spouses.some((s) => s.fullName.toLowerCase().includes(normalizedQuery)));

    return (
      <div key={`${node.numbering}-${node.person.id}`} className={cn(!isRoot && 'ml-5 sm:ml-7')}>
        <div
          className={cn(
            'group relative flex items-center gap-2 rounded-xl border px-3 py-2 transition-all',
            isRoot
              ? 'border-primary/40 bg-primary/5 shadow-sm'
              : 'border-border/60 bg-card/85 hover:border-primary/40 hover:bg-card',
            isSelected && 'border-primary ring-2 ring-primary/25',
            isDirectMatch && 'ring-2 ring-amber-400/70 bg-amber-50/40 dark:bg-amber-950/25'
          )}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.person.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={isCollapsed ? 'Buka cabang' : 'Tutup cabang'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="h-6 w-6 shrink-0 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-border" />
            </span>
          )}

          {/* Branch numbering badge */}
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold',
              isRoot
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {node.numbering}
          </span>

          {/* Gender dot */}
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              node.person.gender === 'male'
                ? 'bg-sky-500'
                : node.person.gender === 'female'
                  ? 'bg-rose-500'
                  : 'bg-muted-foreground/50'
            )}
          />

          {/* Main Person & Spouse Info */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            <button
              type="button"
              onClick={() => onSelectPerson(node.person.id)}
              className="truncate text-left text-sm font-semibold text-foreground hover:text-primary"
            >
              {node.person.fullName}
            </button>

            {life && (
              <span className="text-xs text-muted-foreground">({life})</span>
            )}

            {node.spouses.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Heart className="h-3 w-3 shrink-0 text-rose-500 fill-rose-500" />
                {node.spouses.map((sp, i) => (
                  <span key={sp.id}>
                    {i > 0 && ', '}
                    <button
                      type="button"
                      onClick={() => onSelectPerson(sp.id)}
                      className="font-medium text-foreground/85 hover:text-primary hover:underline"
                    >
                      {sp.fullName}
                    </button>
                  </span>
                ))}
              </span>
            )}
          </div>

          {/* Right badges */}
          <div className="hidden sm:flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] font-normal">
              Gen {node.generation}
            </Badge>
            {node.totalDescendants > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {node.totalDescendants} keturunan
              </Badge>
            )}
          </div>
        </div>

        {/* Children container with vertical guide line */}
        {hasChildren && !isCollapsed && (
          <div className="mt-1.5 space-y-1.5 border-l-2 border-border/55 pl-2 sm:pl-3 ml-3">
            {node.children.map((child) => renderNode(child, false))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/85 px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={rootPersonId || ''}
            onValueChange={(val) => {
              setRootPersonId(val);
              setCollapsedIds(new Set());
            }}
          >
            <SelectTrigger className="h-8 w-[205px] bg-background/90 text-xs">
              <Crown className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <SelectValue placeholder="Pilih sesepuh / pendiri trah..." />
            </SelectTrigger>
            <SelectContent>
              {persons.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-44 sm:w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter nama di trah..."
              className="h-8 pl-8 text-xs bg-background/90"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {outlineTree && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Users className="h-3 w-3" />
              Total {outlineTree.totalDescendants + 1} orang
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={expandAll}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buka Semua</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={collapseAll}
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lipat Cabang</span>
          </Button>
        </div>
      </div>

      {/* Outline Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {outlineTree ? (
          <div data-export-target="true" className="mx-auto max-w-4xl space-y-2 p-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Trah / Keturunan {outlineTree.person.fullName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Klik nama anggota untuk melihat profil lengkap di panel kanan.
                </p>
              </div>
            </div>
            {renderNode(outlineTree, true)}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Pilih sesepuh untuk menampilkan bagan keturunan.
          </div>
        )}
      </div>
    </div>
  );
}
