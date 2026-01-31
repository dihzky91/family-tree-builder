import { useState, useMemo } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, Relationship } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TreePine, Users, GitBranch, Calendar, Filter, Home } from 'lucide-react';
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

export function StoryScopeSelector({ onScopeChange, selectedScope }: StoryScopeSelectorProps) {
  const { persons, relationships, branches } = useFamilyStore() as {
    persons: PersonWithBranch[];
    relationships: Relationship[];
    branches: Branch[];
  };
  
  // Calculate family stats
  const familyStats = useMemo(() => {
    const totalPersons = persons.length;
    const totalBranches = branches?.length || 1;
    const maxGenerations = calculateMaxGenerations(persons, relationships);
    
    // Count by branch
    const branchStats = branches?.map(branch => ({
      ...branch,
      count: persons.filter(p => p.branchId === branch.id).length
    })) || [];
    
    return { totalPersons, totalBranches, maxGenerations, branchStats };
  }, [persons, relationships, branches]);

  // Auto-detect sub-families
  const detectedSubFamilies = useMemo(() => {
    return detectSubFamilies(persons, relationships, selectedScope.maxGenerations);
  }, [persons, relationships, selectedScope.maxGenerations]);

  // Find root persons (those without parents)
  const rootPersons = useMemo(() => {
    return persons.filter(p => {
      const hasParents = relationships.some(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === p.id
      );
      return !hasParents;
    });
  }, [persons, relationships]);

  const handleScopeTypeChange = (type: StoryScope['type']) => {
    onScopeChange({
      ...selectedScope,
      type,
      // Reset specific selections when changing type
      branchId: type === 'branch' ? selectedScope.branchId : undefined,
      rootPersonId: type === 'person' ? selectedScope.rootPersonId : undefined,
      subFamilyId: type === 'subfamily' ? selectedScope.subFamilyId : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          Pilih Scope Cerita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Family Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            <Users className="w-3 h-3 mr-1" />
            {familyStats.totalPersons} Total Anggota
          </Badge>
          <Badge variant="secondary">
            <GitBranch className="w-3 h-3 mr-1" />
            {familyStats.totalBranches} Cabang
          </Badge>
          <Badge variant="secondary">
            <TreePine className="w-3 h-3 mr-1" />
            {familyStats.maxGenerations} Generasi
          </Badge>
          {detectedSubFamilies.length > 0 && (
            <Badge variant="secondary">
              <Home className="w-3 h-3 mr-1" />
              {detectedSubFamilies.length} Sub-Keluarga
            </Badge>
          )}
        </div>

        <Separator />

        {/* Scope Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Scope Cerita</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              onClick={() => handleScopeTypeChange('full')}
              className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                selectedScope.type === 'full'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <TreePine className="w-5 h-5 text-primary" />
                <span className="font-semibold">Seluruh Keluarga</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Generate cerita dari semua {familyStats.totalPersons} anggota
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('branch')}
              className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                selectedScope.type === 'branch'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-5 h-5 text-primary" />
                <span className="font-semibold">Per Cabang</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Fokus pada satu cabang keluarga
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('subfamily')}
              className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                selectedScope.type === 'subfamily'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-5 h-5 text-primary" />
                <span className="font-semibold">Sub-Keluarga</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-detect: {detectedSubFamilies.length} sub-keluarga ditemukan
              </p>
            </div>

            <div
              onClick={() => handleScopeTypeChange('person')}
              className={`cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                selectedScope.type === 'person'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold">Per Orang</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cerita dari satu orang + keturunannya
              </p>
            </div>
          </div>
        </div>

        {/* Branch Selection */}
        {selectedScope.type === 'branch' && (
          <div className="space-y-3">
            <Label>Pilih Cabang</Label>
            <Select
              value={selectedScope.branchId || 'placeholder'}
              onValueChange={(branchId) => onScopeChange({ 
                ...selectedScope, 
                branchId: branchId === 'placeholder' ? undefined : branchId 
              })}
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
                      <div className="flex items-center justify-between w-full">
                        <span>{branch.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {branch.count} orang
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {familyStats.branchStats.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Anda perlu membuat cabang keluarga terlebih dahulu di menu "Cabang"
              </p>
            )}
          </div>
        )}

        {/* Sub-Family Selection */}
        {selectedScope.type === 'subfamily' && (
          <div className="space-y-3">
            <Label>Pilih Sub-Keluarga</Label>
            <Select
              value={selectedScope.subFamilyId || 'placeholder'}
              onValueChange={(subFamilyId) => onScopeChange({ 
                ...selectedScope, 
                subFamilyId: subFamilyId === 'placeholder' ? undefined : subFamilyId 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih sub-keluarga..." />
              </SelectTrigger>
              <SelectContent>
                {detectedSubFamilies.length === 0 ? (
                  <SelectItem value="placeholder" disabled>
                    Tidak ada sub-keluarga yang terdeteksi. Pastikan ada hubungan SPOUSE atau PARENT_CHILD.
                  </SelectItem>
                ) : (
                  detectedSubFamilies.map((subFamily) => (
                    <SelectItem key={subFamily.id} value={subFamily.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">{subFamily.familyName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {subFamily.parents.length} orang tua
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {subFamily.children.length} anak
                          </Badge>
                          <Badge variant="default" className="text-xs">
                            {subFamily.memberCount} total
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {detectedSubFamilies.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sub-keluarga terdeteksi otomatis dari pasangan menikah dan anak-anak mereka
              </p>
            )}
          </div>
        )}

        {/* Person Selection */}
        {selectedScope.type === 'person' && (
          <div className="space-y-3">
            <Label>Pilih Orang (Root)</Label>
            <Select
              value={selectedScope.rootPersonId || 'placeholder'}
              onValueChange={(rootPersonId) => onScopeChange({ 
                ...selectedScope, 
                rootPersonId: rootPersonId === 'placeholder' ? undefined : rootPersonId 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih orang sebagai root..." />
              </SelectTrigger>
              <SelectContent>
                {rootPersons.length === 0 ? (
                  <SelectItem value="placeholder" disabled>
                    Tidak ada data leluhur
                  </SelectItem>
                ) : (
                  rootPersons.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.fullName}
                      {person.birthDate && (
                        <span className="text-muted-foreground ml-2">
                          ({new Date(person.birthDate).getFullYear()})
                        </span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cerita akan mencakup orang ini dan semua keturunannya
            </p>
          </div>
        )}

        <Separator />

        {/* Options */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Opsi Lanjutan</Label>
          
          {/* Max Generations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Maksimal Generasi</Label>
              <Badge variant="outline">{selectedScope.maxGenerations} generasi</Badge>
            </div>
            <Slider
              value={[selectedScope.maxGenerations]}
              onValueChange={([value]) => onScopeChange({ ...selectedScope, maxGenerations: value })}
              min={1}
              max={Math.min(familyStats.maxGenerations, 10)}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Batasi cerita hingga {selectedScope.maxGenerations} generasi untuk fokus
            </p>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSpouses"
                checked={selectedScope.includeSpouses}
                onCheckedChange={(checked) => 
                  onScopeChange({ ...selectedScope, includeSpouses: checked as boolean })
                }
              />
              <Label htmlFor="includeSpouses" className="text-sm">
                Sertakan pasangan (istri/suami)
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
              <Label htmlFor="includeDeceased" className="text-sm">
                Sertakan yang sudah meninggal
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function calculateMaxGenerations(
  persons: Person[],
  relationships: Relationship[]
): number {
  let maxGen = 0;
  const visited = new Set<string>();
  
  // Find all root persons (no parents)
  const roots = persons.filter(p => {
    const hasParents = relationships.some(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === p.id
    );
    return !hasParents;
  });
  
  // BFS to find max depth
  function getGenerationDepth(personId: string, depth: number): number {
    if (visited.has(personId)) return depth;
    visited.add(personId);
    
    const children = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === personId)
      .map(r => r.toPersonId);
    
    if (children.length === 0) return depth;
    
    return Math.max(...children.map(childId => getGenerationDepth(childId, depth + 1)));
  }
  
  for (const root of roots) {
    maxGen = Math.max(maxGen, getGenerationDepth(root.id, 1));
  }
  
  return maxGen;
}

// Auto-detect sub-families from relationships
function detectSubFamilies(
  persons: Person[],
  relationships: Relationship[],
  maxGenerations: number
): SubFamily[] {
  const subFamilies: SubFamily[] = [];
  const processedCouples = new Set<string>();
  
  // Find all married couples (SPOUSE relationships)
  const spouseRelations = relationships.filter(r => r.type === 'SPOUSE');
  
  // Process each married couple
  for (const relation of spouseRelations) {
    // Create unique ID for this couple (sorted to avoid duplicates)
    const coupleId = [relation.fromPersonId, relation.toPersonId].sort().join('-');
    
    if (processedCouples.has(coupleId)) continue;
    processedCouples.add(coupleId);
    
    const parent1 = persons.find(p => p.id === relation.fromPersonId);
    const parent2 = persons.find(p => p.id === relation.toPersonId);
    
    if (!parent1 || !parent2) continue;
    
    // Find children of this couple
    const children = findChildrenOfCouple(persons, relationships, relation.fromPersonId, relation.toPersonId);
    
    // Build family name
    const familyName = `Keluarga ${parent1.fullName.split(' ')[0]} & ${parent2.fullName.split(' ')[0]}`;
    
    // Get all members including descendants up to maxGenerations
    const allMembers = getFamilyMembersWithDescendants(
      persons,
      relationships,
      [parent1, parent2],
      children,
      maxGenerations
    );
    
    subFamilies.push({
      id: coupleId,
      parents: [parent1, parent2],
      children,
      allMembers,
      familyName,
      memberCount: allMembers.length
    });
  }
  
  // Find single parents (people with children but no spouse)
  const parentsWithChildren = new Set<string>();
  
  // Collect all parents from PARENT_CHILD relationships
  for (const relation of relationships.filter(r => r.type === 'PARENT_CHILD')) {
    parentsWithChildren.add(relation.fromPersonId);
  }
  
  // Find parents who are not in any couple
  for (const parentId of parentsWithChildren) {
    // Check if this parent is part of a couple
    const isInCouple = spouseRelations.some(
      r => r.fromPersonId === parentId || r.toPersonId === parentId
    );
    
    if (!isInCouple) {
      const parent = persons.find(p => p.id === parentId);
      if (!parent) continue;
      
      // Find children of this single parent
      const children = findChildrenOfParent(persons, relationships, parentId);
      
      if (children.length > 0) {
        const familyName = `Keluarga ${parent.fullName.split(' ')[0]} (Single Parent)`;
        
        const allMembers = getFamilyMembersWithDescendants(
          persons,
          relationships,
          [parent],
          children,
          maxGenerations
        );
        
        subFamilies.push({
          id: `single-${parentId}`,
          parents: [parent],
          children,
          allMembers,
          familyName,
          memberCount: allMembers.length
        });
      }
    }
  }
  
  // Sort by member count (largest first)
  return subFamilies.sort((a, b) => b.memberCount - a.memberCount);
}

// Find children of a couple (children who have both parents or either parent)
function findChildrenOfCouple(
  persons: Person[],
  relationships: Relationship[],
  parent1Id: string,
  parent2Id: string
): Person[] {
  const childrenIds = new Set<string>();
  
  // Find all children of parent1
  const childrenOfParent1 = relationships
    .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent1Id)
    .map(r => r.toPersonId);
  
  // Find all children of parent2
  const childrenOfParent2 = relationships
    .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parent2Id)
    .map(r => r.toPersonId);
  
  // Children of the couple are those who appear in either list
  // (We include children even if they only have one parent in the system)
  for (const childId of [...childrenOfParent1, ...childrenOfParent2]) {
    childrenIds.add(childId);
  }
  
  return persons.filter(p => p.id && childrenIds.has(p.id));
}

// Find children of a single parent
function findChildrenOfParent(
  persons: Person[],
  relationships: Relationship[],
  parentId: string
): Person[] {
  const childrenIds = relationships
    .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === parentId)
    .map(r => r.toPersonId);
  
  return persons.filter(p => p.id && childrenIds.includes(p.id));
}

// Get all family members including descendants up to maxGenerations
function getFamilyMembersWithDescendants(
  persons: Person[],
  relationships: Relationship[],
  parents: Person[],
  children: Person[],
  maxGenerations: number
): Person[] {
  const memberIds = new Set<string>();
  
  // Add all parents
  for (const parent of parents) {
    if (parent.id) memberIds.add(parent.id);
  }
  
  // BFS to add children and their descendants
  const toProcess: Array<{ personId: string; generation: number }> = [];
  
  // Initialize with direct children
  for (const child of children) {
    if (child.id) {
      memberIds.add(child.id);
      toProcess.push({ personId: child.id, generation: 1 });
    }
  }
  
  // Process descendants
  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    
    if (current.generation >= maxGenerations) continue;
    
    // Find children of this person
    const grandChildren = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === current.personId)
      .map(r => r.toPersonId);
    
    for (const grandChildId of grandChildren) {
      if (!memberIds.has(grandChildId)) {
        memberIds.add(grandChildId);
        toProcess.push({ personId: grandChildId, generation: current.generation + 1 });
      }
    }
  }
  
  return persons.filter(p => p.id && memberIds.has(p.id));
}

// Extended Person type with branchId from store
interface PersonWithBranch extends Person {
  branchId?: string;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
  rootPersonId?: string;
  coordinatorName?: string;
  description?: string;
  isActive?: boolean;
  submissionCount?: number;
  approvedCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Filter persons based on scope
export function filterPersonsByScope(
  persons: PersonWithBranch[],
  relationships: Relationship[],
  scope: StoryScope
): PersonWithBranch[] {
  switch (scope.type) {
    case 'full':
      return persons;
    
    case 'branch':
      if (!scope.branchId) return persons;
      return persons.filter(p => p.branchId === scope.branchId);
    
    case 'subfamily':
      if (!scope.subFamilyId) return persons;
      
      // Detect sub-families and filter by selected one
      const subFamilies = detectSubFamilies(persons, relationships, scope.maxGenerations);
      const selectedSubFamily = subFamilies.find(sf => sf.id === scope.subFamilyId);
      
      if (!selectedSubFamily) return persons;
      
      // Return all members of the selected sub-family
      const memberIds = new Set(selectedSubFamily.allMembers.map(p => p.id));
      return persons.filter(p => p.id && memberIds.has(p.id));
    
    case 'person':
      if (!scope.rootPersonId) return persons;
      return getDescendants(persons, relationships, scope.rootPersonId, scope.maxGenerations);
    
    default:
      return persons;
  }
}

// Get all descendants of a person up to X generations
function getDescendants<T extends { id?: string }>(
  persons: T[],
  relationships: Relationship[],
  rootId: string,
  maxGenerations: number
): T[] {
  const result = new Set<string>([rootId]);
  const toProcess = [{ id: rootId, generation: 1 }];
  
  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    
    if (current.generation >= maxGenerations) continue;
    
    // Find children
    const children = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === current.id)
      .map(r => r.toPersonId);
    
    for (const childId of children) {
      if (!result.has(childId)) {
        result.add(childId);
        toProcess.push({ id: childId, generation: current.generation + 1 });
      }
    }
  }
  
  return persons.filter(p => p.id && result.has(p.id));
}
