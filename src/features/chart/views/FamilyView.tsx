import { memo, useMemo, useEffect } from 'react';
import type { Person, Relationship } from '@/types';
import { FamilyMainView } from './FamilyMainView';
import { transformToFamilyChartData } from '../utils/familyChartMapper';
import { useFamilyStore } from '@/store/familyStore';
import { useAuth } from '@/hooks/useAuth';

interface FamilyViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent' | 'spouse' | 'child') => void;
  readOnly?: boolean;
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const FamilyView = memo(function FamilyView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
  readOnly = false,
}: FamilyViewProps) {
  const { homePersonId, setHomePerson } = useFamilyStore();
  const { profile, user } = useAuth();

  // Resolve the "Home / Saya" person (pinned homePersonId OR account name match) — disabled on public read-only links
  const resolvedHomePerson = useMemo(() => {
    if (readOnly || persons.length === 0) return null;

    // 1. Explicitly pinned home person
    if (homePersonId) {
      const pinned = persons.find((p) => p.id === homePersonId);
      if (pinned) return pinned;
    }

    // 2. Match logged-in account display_name / user_metadata.full_name / email prefix
    const candidateNames = [
      profile?.display_name,
      typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
      typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : null,
      user?.email ? user.email.split('@')[0].replace(/[._-]+/g, ' ') : null,
    ].filter((v): v is string => Boolean(v && v.trim().length >= 2));

    for (const rawCandidate of candidateNames) {
      const candidate = normalizeName(rawCandidate);
      if (!candidate) continue;

      // Exact full name match
      const exact = persons.find((p) => normalizeName(p.fullName) === candidate);
      if (exact) return exact;

      // Substring / token match (e.g. "Eko Budiardi" or "budiardi")
      const tokenMatch = persons.find((p) => {
        const pNorm = normalizeName(p.fullName);
        return (
          pNorm.includes(candidate) ||
          candidate.includes(pNorm) ||
          candidate
            .split(' ')
            .filter((t) => t.length >= 3)
            .every((t) => pNorm.includes(t))
        );
      });
      if (tokenMatch) return tokenMatch;
    }

    return null;
  }, [readOnly, persons, homePersonId, profile?.display_name, user]);

  // Persist auto-detected home person if none was stored yet
  useEffect(() => {
    if (!readOnly && !homePersonId && resolvedHomePerson) {
      setHomePerson(resolvedHomePerson.id);
    }
  }, [readOnly, homePersonId, resolvedHomePerson, setHomePerson]);

  // Auto-select sensible default root so the tree renders immediately on the Home Person ("Saya")
  const focusPerson = useMemo(() => {
    if (selectedPersonId) {
      const found = persons.find((p) => p.id === selectedPersonId);
      if (found) return found;
    }
    if (persons.length === 0) return null;

    if (resolvedHomePerson) {
      return resolvedHomePerson;
    }

    // Prefer a middle-generation person who has BOTH parents AND children (balanced tree like MyHeritage)
    const hasParents = new Set<string>();
    const hasChildren = new Set<string>();
    const connectionCount = new Map<string, number>();

    relationships.forEach((r) => {
      connectionCount.set(r.fromPersonId, (connectionCount.get(r.fromPersonId) || 0) + 1);
      connectionCount.set(r.toPersonId, (connectionCount.get(r.toPersonId) || 0) + 1);
      if (r.type === 'PARENT_CHILD') {
        hasChildren.add(r.fromPersonId);
        hasParents.add(r.toPersonId);
      }
    });

    const balancedCandidates = persons.filter(
      (p) => hasParents.has(p.id) && hasChildren.has(p.id)
    );
    const pool = balancedCandidates.length > 0 ? balancedCandidates : persons;

    return [...pool].sort(
      (a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0)
    )[0];
  }, [persons, relationships, selectedPersonId, resolvedHomePerson]);

  const summary = useMemo(() => {
    if (!focusPerson) return undefined;

    const parentIds = new Set<string>();
    const spouseIds = new Set<string>();
    const childIds = new Set<string>();

    relationships.forEach((r) => {
      if (r.type === 'PARENT_CHILD') {
        if (r.toPersonId === focusPerson.id) parentIds.add(r.fromPersonId);
        if (r.fromPersonId === focusPerson.id) childIds.add(r.toPersonId);
      } else if (r.type === 'SPOUSE') {
        if (r.fromPersonId === focusPerson.id) spouseIds.add(r.toPersonId);
        if (r.toPersonId === focusPerson.id) spouseIds.add(r.fromPersonId);
      }
    });

    // Include spouse's children
    spouseIds.forEach((sid) => {
      relationships.forEach((r) => {
        if (r.type === 'PARENT_CHILD' && r.fromPersonId === sid) {
          childIds.add(r.toPersonId);
        }
      });
    });

    const siblingIds = new Set<string>();
    if (parentIds.size > 0) {
      relationships.forEach((r) => {
        if (
          r.type === 'PARENT_CHILD' &&
          parentIds.has(r.fromPersonId) &&
          r.toPersonId !== focusPerson.id
        ) {
          siblingIds.add(r.toPersonId);
        }
      });
    }

    return {
      parents: parentIds.size,
      spouses: spouseIds.size,
      children: childIds.size,
      siblings: siblingIds.size,
    };
  }, [focusPerson, relationships]);

  const familyChartData = useMemo(
    () => transformToFamilyChartData(persons, relationships),
    [persons, relationships]
  );

  if (!focusPerson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">Belum ada anggota keluarga untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <FamilyMainView
      data={familyChartData}
      rootId={focusPerson.id}
      rootPerson={focusPerson}
      homePerson={readOnly ? null : resolvedHomePerson}
      onSetHomePerson={readOnly ? undefined : setHomePerson}
      summary={summary}
      onSelectPerson={onSelectPerson}
      onAddRelationship={onAddRelationship ? (id) => onAddRelationship(id, 'child') : undefined}
    />
  );
});

FamilyView.displayName = 'FamilyView';
