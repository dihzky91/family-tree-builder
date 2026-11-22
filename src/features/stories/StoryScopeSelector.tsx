import { useMemo } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, Relationship } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TreePine, Users, GitBranch, Filter, Home, Heart, Layers, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export interface StoryScope {
  type: 'full' | 'branch' | 'person' | 'subfamily';
  branchId?: string;
  rootPersonId?: string;
  subFamilyId?: string;
  maxGenerations: number;
  includeSpouses: boolean;
  includeDeceased: boolean;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface PersonWithBranch extends Person {
  branchId?: string;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
  rootPersonId?: string;
}

interface SubFamily {
  id: string;
  parents: Person[];
  children: Person[];
  allMembers: Person[];
  familyName: string;
  memberCount: number;
}

interface StoryScopeSelectorProps {
  onScopeChange: (scope: StoryScope) => void;
  selectedScope: StoryScope;
}

/**
 * Aligns every person into an accurate 0-based generation index:
 * - Parent -> Child increments generation by +1
 * - Spouses without parents (in-laws / menantu) align to their spouse's generation
 *   instead of being misclassified as Generation 1 ancestors
 * - Isolated orphans fall back to birth-year estimation against known generation ranges
 * - Normalized so oldest generation is always 0 (Generasi 1)
 */
export function computeAlignedGenerations(
  persons: Person[],
  relationships: Relationship[]
): {
  generations: Person[][];
  personGenMap: Map<string, number>;
} {
  if (persons.length === 0) {
    return { generations: [], personGenMap: new Map() };
  }

  const personIds = new Set(persons.map((p) => p.id));
  const scopedRels = relationships.filter(
    (r) => personIds.has(r.fromPersonId) && personIds.has(r.toPersonId)
  );

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const r of scopedRels) {
    if (r.type === 'PARENT_CHILD') {
      if (!parentsOf.has(r.toPersonId)) parentsOf.set(r.toPersonId, []);
      parentsOf.get(r.toPersonId)!.push(r.fromPersonId);

      if (!childrenOf.has(r.fromPersonId)) childrenOf.set(r.fromPersonId, []);
      childrenOf.get(r.fromPersonId)!.push(r.toPersonId);
    } else if (r.type === 'SPOUSE') {
      if (!spousesOf.has(r.fromPersonId)) spousesOf.set(r.fromPersonId, []);
      if (!spousesOf.get(r.fromPersonId)!.includes(r.toPersonId)) {
        spousesOf.get(r.fromPersonId)!.push(r.toPersonId);
      }
      if (!spousesOf.has(r.toPersonId)) spousesOf.set(r.toPersonId, []);
      if (!spousesOf.get(r.toPersonId)!.includes(r.fromPersonId)) {
        spousesOf.get(r.toPersonId)!.push(r.fromPersonId);
      }
    }
  }

  // BFS per connected component using relative generation offsets:
  // parent -> child = +1, child -> parent = -1, spouse <-> spouse = 0
  const rawGen = new Map<string, number>();

  // Sort persons by birthDate ascending so BFS seeds from oldest people first
  const sortedPersons = [...persons].sort((a, b) => {
    const ya = a.birthDate ? new Date(a.birthDate).getFullYear() : 9999;
    const yb = b.birthDate ? new Date(b.birthDate).getFullYear() : 9999;
    return ya - yb;
  });

  // Track components so we can align separate components by birth year if needed
  const components: Array<{ ids: string[]; genMap: Map<string, number> }> = [];

  for (const startPerson of sortedPersons) {
    if (rawGen.has(startPerson.id)) continue;

    const compMap = new Map<string, number>();
    const queue: Array<{ id: string; gen: number }> = [{ id: startPerson.id, gen: 0 }];
    compMap.set(startPerson.id, 0);
    rawGen.set(startPerson.id, 0);

    while (queue.length > 0) {
      const { id, gen } = queue.shift()!;

      for (const childId of childrenOf.get(id) || []) {
        if (!compMap.has(childId)) {
          compMap.set(childId, gen + 1);
          rawGen.set(childId, gen + 1);
          queue.push({ id: childId, gen: gen + 1 });
        }
      }

      for (const parentId of parentsOf.get(id) || []) {
        if (!compMap.has(parentId)) {
          compMap.set(parentId, gen - 1);
          rawGen.set(parentId, gen - 1);
          queue.push({ id: parentId, gen: gen - 1 });
        }
      }

      for (const spouseId of spousesOf.get(id) || []) {
        if (!compMap.has(spouseId)) {
          compMap.set(spouseId, gen);
          rawGen.set(spouseId, gen);
          queue.push({ id: spouseId, gen });
        }
      }
    }

    components.push({ ids: Array.from(compMap.keys()), genMap: compMap });
  }

  // Normalize main (largest) component to start at 0, then align smaller disconnected components by birth year
  components.sort((a, b) => b.ids.length - a.ids.length);
  const finalGen = new Map<string, number>();

  if (components.length > 0) {
    const main = components[0];
    const mainMin = Math.min(...Array.from(main.genMap.values()));
    main.genMap.forEach((g, id) => finalGen.set(id, g - mainMin));

    // Build average birth year per generation in main component
    const genYears = new Map<number, number[]>();
    const personById = new Map(persons.map((p) => [p.id, p]));
    finalGen.forEach((g, id) => {
      const p = personById.get(id);
      if (p?.birthDate) {
        const y = new Date(p.birthDate).getFullYear();
        if (!Number.isNaN(y)) {
          if (!genYears.has(g)) genYears.set(g, []);
          genYears.get(g)!.push(y);
        }
      }
    });

    const genAvgYear = new Map<number, number>();
    genYears.forEach((ys, g) => {
      genAvgYear.set(g, ys.reduce((a, b) => a + b, 0) / ys.length);
    });

    // Align remaining disconnected components
    for (let i = 1; i < components.length; i++) {
      const comp = components[i];
      const compMin = Math.min(...Array.from(comp.genMap.values()));
      let offset = 0;

      // Find oldest person with birth year in this component
      let sampleGen: number | null = null;
      let sampleYear: number | null = null;
      for (const id of comp.ids) {
        const p = personById.get(id);
        if (p?.birthDate) {
          const y = new Date(p.birthDate).getFullYear();
          if (!Number.isNaN(y) && (sampleYear === null || y < sampleYear)) {
            sampleYear = y;
            sampleGen = comp.genMap.get(id)! - compMin;
          }
        }
      }

      if (sampleYear !== null && sampleGen !== null && genAvgYear.size > 0) {
        let bestMainGen = 0;
        let bestDiff = Infinity;
        genAvgYear.forEach((avgY, g) => {
          const diff = Math.abs(sampleYear! - avgY);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestMainGen = g;
          }
        });
        const estimatedGen =
          bestMainGen + Math.round((sampleYear - genAvgYear.get(bestMainGen)!) / 25);
        offset = estimatedGen - sampleGen;
      }

      comp.genMap.forEach((g, id) => finalGen.set(id, g - compMin + offset));
    }
  }

  // Final normalization so minimum generation across all persons is 0
  const minAll = Math.min(...Array.from(finalGen.values()));
  const normalizedMap = new Map<string, number>();
  finalGen.forEach((g, id) => normalizedMap.set(id, g - minAll));

  const byGen = new Map<number, Person[]>();
  for (const p of persons) {
    const g = normalizedMap.get(p.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }

  const generations = Array.from(byGen.entries())
    .sort(([a], [b]) => a - b)
    .map(([, members]) =>
      members.sort((a, b) => {
        const ya = a.birthDate ? new Date(a.birthDate).getFullYear() : 9999;
        const yb = b.birthDate ? new Date(b.birthDate).getFullYear() : 9999;
        if (ya !== yb) return ya - yb;
        return a.fullName.localeCompare(b.fullName, 'id');
      })
    );

  return { generations, personGenMap: normalizedMap };
}

export function StoryScopeSelector({ onScopeChange, selectedScope }: StoryScopeSelectorProps) {
  const { persons, relationships, branches } = useFamilyStore() as {
    persons: PersonWithBranch[];
    relationships: Relationship[];
    branches: Branch[];
  };

  // Calculate accurate family stats
  const familyStats = useMemo(() => {
    const totalPersons = persons.length;
    const totalBranches = branches?.length || 0;
    const { generations } = computeAlignedGenerations(persons, relationships);
    const maxGenerations = Math.max(1, generations.length);

    const branchStats =
      branches?.map((branch) => ({
        ...branch,
        count: persons.filter((p) => p.branchId === branch.id).length,
      })) || [];

    return { totalPersons, totalBranches, maxGenerations, branchStats };
  }, [persons, relationships, branches]);

  // Auto-detect sub-families
  const detectedSubFamilies = useMemo(() => {
    return detectSubFamilies(
      persons,
      relationships,
      selectedScope.maxGenerations,
      selectedScope.includeSpouses
    );
  }, [persons, relationships, selectedScope.maxGenerations, selectedScope.includeSpouses]);

  // Sorted list of ALL persons for "Per Orang" scope (not just rootPersons!)
  const sortedAllPersons = useMemo(() => {
    return [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
  }, [persons]);

  // Live preview of what will actually be pulled for the selected scope
  const previewStats = useMemo(() => {
    const scopedPersons = filterPersonsByScope(persons, relationships, selectedScope);
    const scopedIds = new Set(scopedPersons.map((p) => p.id));
    const scopedRels = relationships.filter(
      (r) => scopedIds.has(r.fromPersonId) && scopedIds.has(r.toPersonId)
    );
    const { generations } = computeAlignedGenerations(scopedPersons, scopedRels);
    const uniqueCouples = new Set<string>();
    scopedRels.forEach((r) => {
      if (r.type === 'SPOUSE') {
        uniqueCouples.add([r.fromPersonId, r.toPersonId].sort().join('-'));
      }
    });
    return {
      members: scopedPersons.length,
      generations: generations.length,
      couples: uniqueCouples.size,
    };
  }, [persons, relationships, selectedScope]);

  const handleScopeTypeChange = (type: StoryScope['type']) => {
    onScopeChange({
      ...selectedScope,
      type,
      branchId: type === 'branch' ? selectedScope.branchId : undefined,
      rootPersonId: type === 'person' ? selectedScope.rootPersonId : undefined,
      subFamilyId: type === 'subfamily' ? selectedScope.subFamilyId : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Filter className="w-5 h-5 text-primary" />
          Pilih Cakupan Cerita
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-5">
        {/* Live Scope Preview Banner */}
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>Data yang akan ditarik ke cerita:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {previewStats.members} Anggota
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Layers className="w-3 h-3 mr-1" />
              {previewStats.generations} Generasi
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Heart className="w-3 h-3 mr-1" />
              {previewStats.couples} Pasangan
            </Badge>
          </div>
        </div>

        {/* Scope Type Selection */}
        <div className="space-y-2.5">
          <Label className="text-sm font-semibold">Mode Cakupan</Label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div
              onClick={() => handleScopeTypeChange('full')}
              className={`cursor-pointer rounded-xl border p-3 sm:p-4 transition-all hover:border-primary ${
                selectedScope.type === 'full'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <TreePine className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs sm:text-sm">Seluruh Keluarga</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Semua {familyStats.totalPersons} anggota sesuai filter
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('subfamily')}
              className={`cursor-pointer rounded-xl border p-3 sm:p-4 transition-all hover:border-primary ${
                selectedScope.type === 'subfamily'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Home className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs sm:text-sm">Sub-Keluarga</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {detectedSubFamilies.length} keluarga inti terdeteksi
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('person')}
              className={`cursor-pointer rounded-xl border p-3 sm:p-4 transition-all hover:border-primary ${
                selectedScope.type === 'person'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs sm:text-sm">Biografi / Per Orang</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Kisah 1 tokoh + keluarga & keturunannya
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('branch')}
              className={`cursor-pointer rounded-xl border p-3 sm:p-4 transition-all hover:border-primary ${
                selectedScope.type === 'branch'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <GitBranch className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-xs sm:text-sm">Per Cabang</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Fokus pada 1 cabang ({familyStats.totalBranches} cabang)
              </p>
            </div>
          </div>
        </div>

        {/* Branch Selection */}
        {selectedScope.type === 'branch' && (
          <div className="space-y-2">
            <Label>Pilih Cabang</Label>
            <Select
              value={selectedScope.branchId || 'placeholder'}
              onValueChange={(branchId) =>
                onScopeChange({
                  ...selectedScope,
                  branchId: branchId === 'placeholder' ? undefined : branchId,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih cabang keluarga..." />
              </SelectTrigger>
              <SelectContent>
                {familyStats.branchStats.length === 0 ? (
                  <SelectItem value="placeholder" disabled>
                    Belum ada cabang keluarga. Tambahkan di menu Cabang.
                  </SelectItem>
                ) : (
                  familyStats.branchStats.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.count} orang)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sub-Family Selection */}
        {selectedScope.type === 'subfamily' && (
          <div className="space-y-2">
            <Label>Pilih Sub-Keluarga</Label>
            <Select
              value={selectedScope.subFamilyId || 'placeholder'}
              onValueChange={(subFamilyId) =>
                onScopeChange({
                  ...selectedScope,
                  subFamilyId: subFamilyId === 'placeholder' ? undefined : subFamilyId,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih sub-keluarga..." />
              </SelectTrigger>
              <SelectContent>
                {detectedSubFamilies.length === 0 ? (
                  <SelectItem value="placeholder" disabled>
                    Tidak ada sub-keluarga terdeteksi.
                  </SelectItem>
                ) : (
                  detectedSubFamilies.map((subFamily) => (
                    <SelectItem key={subFamily.id} value={subFamily.id}>
                      {subFamily.familyName} — {subFamily.children.length} anak ({subFamily.memberCount} total)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Person Selection (ALL persons available, not just roots!) */}
        {selectedScope.type === 'person' && (
          <div className="space-y-2">
            <Label>Pilih Tokoh Utama</Label>
            <Select
              value={selectedScope.rootPersonId || 'placeholder'}
              onValueChange={(rootPersonId) =>
                onScopeChange({
                  ...selectedScope,
                  rootPersonId: rootPersonId === 'placeholder' ? undefined : rootPersonId,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih anggota keluarga..." />
              </SelectTrigger>
              <SelectContent>
                {sortedAllPersons.length === 0 ? (
                  <SelectItem value="placeholder" disabled>
                    Belum ada data anggota
                  </SelectItem>
                ) : (
                  sortedAllPersons.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.fullName}
                      {person.birthDate ? ` (${new Date(person.birthDate).getFullYear()})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Menghasilkan biografi tokoh ini beserta pasangan dan keturunannya.
            </p>
          </div>
        )}

        <Separator />

        {/* Options */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Maksimal Generasi</Label>
              <Badge variant="outline">{selectedScope.maxGenerations} generasi</Badge>
            </div>
            <Slider
              value={[Math.min(selectedScope.maxGenerations, Math.max(familyStats.maxGenerations, 1))]}
              onValueChange={([value]) => onScopeChange({ ...selectedScope, maxGenerations: value })}
              min={1}
              max={Math.max(familyStats.maxGenerations, 1)}
              step={1}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSpouses"
                checked={selectedScope.includeSpouses}
                onCheckedChange={(checked) =>
                  onScopeChange({ ...selectedScope, includeSpouses: checked as boolean })
                }
              />
              <Label htmlFor="includeSpouses" className="text-sm cursor-pointer">
                Sertakan pasangan (menantu/istri/suami)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDeceased"
                checked={selectedScope.includeDeceased}
                onCheckedChange={(checked) =>
                  onScopeChange({ ...selectedScope, includeDeceased: checked as boolean })
                }
              />
              <Label htmlFor="includeDeceased" className="text-sm cursor-pointer">
                Sertakan almarhum/ah
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Auto-detect sub-families from relationships
function detectSubFamilies(
  persons: Person[],
  relationships: Relationship[],
  maxGenerations: number,
  includeSpouses: boolean
): SubFamily[] {
  const subFamilies: SubFamily[] = [];
  const processedCouples = new Set<string>();
  const spouseRelations = relationships.filter((r) => r.type === 'SPOUSE');

  for (const relation of spouseRelations) {
    const coupleId = [relation.fromPersonId, relation.toPersonId].sort().join('-');
    if (processedCouples.has(coupleId)) continue;
    processedCouples.add(coupleId);

    const parent1 = persons.find((p) => p.id === relation.fromPersonId);
    const parent2 = persons.find((p) => p.id === relation.toPersonId);
    if (!parent1 || !parent2) continue;

    const children = findChildrenOfCouple(persons, relationships, parent1.id, parent2.id);
    const familyName = `Keluarga ${parent1.fullName.split(' ')[0]} & ${parent2.fullName.split(' ')[0]}`;
    const allMembers = getFamilyMembersWithDescendants(
      persons,
      relationships,
      [parent1, parent2],
      children,
      maxGenerations,
      includeSpouses
    );

    subFamilies.push({
      id: coupleId,
      parents: [parent1, parent2],
      children,
      allMembers,
      familyName,
      memberCount: allMembers.length,
    });
  }

  // Single parents
  const parentsWithChildren = new Set<string>();
  for (const r of relationships) {
    if (r.type === 'PARENT_CHILD') parentsWithChildren.add(r.fromPersonId);
  }

  for (const parentId of parentsWithChildren) {
    const isInCouple = spouseRelations.some(
      (r) => r.fromPersonId === parentId || r.toPersonId === parentId
    );
    if (!isInCouple) {
      const parent = persons.find((p) => p.id === parentId);
      if (!parent) continue;
      const children = findChildrenOfParent(persons, relationships, parentId);
      if (children.length > 0) {
        const familyName = `Keluarga ${parent.fullName.split(' ')[0]}`;
        const allMembers = getFamilyMembersWithDescendants(
          persons,
          relationships,
          [parent],
          children,
          maxGenerations,
          includeSpouses
        );
        subFamilies.push({
          id: `single-${parentId}`,
          parents: [parent],
          children,
          allMembers,
          familyName,
          memberCount: allMembers.length,
        });
      }
    }
  }

  return subFamilies.sort((a, b) => b.memberCount - a.memberCount);
}

function findChildrenOfCouple(
  persons: Person[],
  relationships: Relationship[],
  parent1Id: string,
  parent2Id: string
): Person[] {
  const childrenIds = new Set<string>();
  relationships.forEach((r) => {
    if (r.type === 'PARENT_CHILD' && (r.fromPersonId === parent1Id || r.fromPersonId === parent2Id)) {
      childrenIds.add(r.toPersonId);
    }
  });
  return persons.filter((p) => childrenIds.has(p.id));
}

function findChildrenOfParent(
  persons: Person[],
  relationships: Relationship[],
  parentId: string
): Person[] {
  const childrenIds = new Set(
    relationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.fromPersonId === parentId)
      .map((r) => r.toPersonId)
  );
  return persons.filter((p) => childrenIds.has(p.id));
}

function getFamilyMembersWithDescendants(
  persons: Person[],
  relationships: Relationship[],
  parents: Person[],
  children: Person[],
  maxGenerations: number,
  includeSpouses: boolean
): Person[] {
  const memberIds = new Set<string>();
  const descendantIds = new Set<string>();

  for (const parent of parents) {
    memberIds.add(parent.id);
  }

  if (maxGenerations > 1) {
    const toProcess: Array<{ personId: string; generation: number }> = [];
    for (const child of children) {
      memberIds.add(child.id);
      descendantIds.add(child.id);
      toProcess.push({ personId: child.id, generation: 2 });
    }

    while (toProcess.length > 0) {
      const current = toProcess.shift()!;
      if (current.generation >= maxGenerations) continue;

      const grandChildren = relationships
        .filter((r) => r.type === 'PARENT_CHILD' && r.fromPersonId === current.personId)
        .map((r) => r.toPersonId);

      for (const grandChildId of grandChildren) {
        if (!memberIds.has(grandChildId)) {
          memberIds.add(grandChildId);
          descendantIds.add(grandChildId);
          toProcess.push({ personId: grandChildId, generation: current.generation + 1 });
        }
      }
    }
  }

  // Optionally include spouses of descendants
  if (includeSpouses) {
    for (const r of relationships) {
      if (r.type !== 'SPOUSE') continue;
      if (descendantIds.has(r.fromPersonId)) memberIds.add(r.toPersonId);
      if (descendantIds.has(r.toPersonId)) memberIds.add(r.fromPersonId);
    }
  }

  return persons.filter((p) => memberIds.has(p.id));
}

function getDescendants(
  persons: PersonWithBranch[],
  relationships: Relationship[],
  rootId: string,
  maxGenerations: number,
  includeSpouses: boolean
): PersonWithBranch[] {
  const result = new Set<string>([rootId]);
  const toProcess = [{ id: rootId, generation: 1 }];

  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    if (current.generation >= maxGenerations) continue;

    const children = relationships
      .filter((r) => r.type === 'PARENT_CHILD' && r.fromPersonId === current.id)
      .map((r) => r.toPersonId);

    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        toProcess.push({ id: childId, generation: current.generation + 1 });
      }
    }
  }

  if (includeSpouses) {
    const currentIds = Array.from(result);
    for (const r of relationships) {
      if (r.type !== 'SPOUSE') continue;
      if (currentIds.includes(r.fromPersonId)) result.add(r.toPersonId);
      if (currentIds.includes(r.toPersonId)) result.add(r.fromPersonId);
    }
  }

  return persons.filter((p) => result.has(p.id));
}

// Filter persons strictly based on ALL scope options (type, maxGenerations, includeSpouses, includeDeceased)
export function filterPersonsByScope(
  persons: PersonWithBranch[],
  relationships: Relationship[],
  scope: StoryScope
): PersonWithBranch[] {
  let result: PersonWithBranch[] = [];

  switch (scope.type) {
    case 'full': {
      const { personGenMap } = computeAlignedGenerations(persons, relationships);
      result = persons.filter((p) => (personGenMap.get(p.id) ?? 0) < scope.maxGenerations);
      if (!scope.includeSpouses) {
        // Keep Generation 1 roots & direct blood descendants (anyone with parents in set or in gen 0)
        const resultIds = new Set(result.map((p) => p.id));
        result = result.filter((p) => {
          const gen = personGenMap.get(p.id) ?? 0;
          if (gen === 0) return true;
          const hasParentInSet = relationships.some(
            (r) => r.type === 'PARENT_CHILD' && r.toPersonId === p.id && resultIds.has(r.fromPersonId)
          );
          return hasParentInSet;
        });
      }
      break;
    }

    case 'branch': {
      const branchPersons = scope.branchId
        ? persons.filter((p) => p.branchId === scope.branchId)
        : persons;
      const { personGenMap } = computeAlignedGenerations(branchPersons, relationships);
      result = branchPersons.filter((p) => (personGenMap.get(p.id) ?? 0) < scope.maxGenerations);
      break;
    }

    case 'subfamily': {
      if (!scope.subFamilyId) {
        result = persons;
      } else {
        const subFamilies = detectSubFamilies(
          persons,
          relationships,
          scope.maxGenerations,
          scope.includeSpouses
        );
        const selectedSubFamily = subFamilies.find((sf) => sf.id === scope.subFamilyId);
        if (!selectedSubFamily) {
          result = persons;
        } else {
          const memberIds = new Set(selectedSubFamily.allMembers.map((p) => p.id));
          result = persons.filter((p) => memberIds.has(p.id));
        }
      }
      break;
    }

    case 'person': {
      if (!scope.rootPersonId) {
        result = persons;
      } else {
        result = getDescendants(
          persons,
          relationships,
          scope.rootPersonId,
          scope.maxGenerations,
          scope.includeSpouses
        );
      }
      break;
    }

    default:
      result = persons;
  }

  // Strictly enforce includeDeceased
  if (!scope.includeDeceased) {
    result = result.filter((p) => !p.deathDate);
  }

  return result;
}
