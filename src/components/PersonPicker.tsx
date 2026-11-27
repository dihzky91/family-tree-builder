import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatShortYearLabel } from '@/lib/flexibleDateUtils';
import { buildTrahClusters, type TrahCluster } from '@/lib/lineageScope';
import { TrahBadgeList } from '@/components/TrahBadgeList';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, Relationship } from '@/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

interface PersonPickerProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPerson: Person | null;
  onSelect: (person: Person) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  placeholder?: string;
  popoverClassName?: string;
  align?: 'start' | 'center' | 'end';
  excludeIds?: string[];
}

interface IndexedPerson {
  person: Person;
  birthYear: string;
  subLabel: string;
  clusters: TrahCluster[];
  searchText: string;
  normalizedFullName: string;
  firstNameKey: string;
}

export function PersonPicker({
  persons,
  relationships,
  selectedPerson,
  onSelect,
  open,
  onOpenChange,
  trigger,
  placeholder = 'Cari nama, trah, tahun, kota...',
  popoverClassName = 'w-[300px] p-0',
  align = 'start',
  excludeIds,
}: PersonPickerProps) {
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const homePersonId = useFamilyStore((s) => s.homePersonId);
  const pinnedLineageIds = useFamilyStore((s) => s.pinnedLineageIds);

  const trahIndex = useMemo(
    () =>
      buildTrahClusters({
        homePersonId,
        pinnedLineageIds,
        persons,
        relationships,
      }),
    [homePersonId, pinnedLineageIds, persons, relationships]
  );

  // Reset search & pagination when popover closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setVisibleLimit(PAGE_SIZE);
    }
  }, [open]);

  // Reset pagination when query changes
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [query]);

  // Precompute lightweight index + relation hints once per data change
  const indexedPersons = useMemo<IndexedPerson[]>(() => {
    const excludeSet = excludeIds && excludeIds.length > 0 ? new Set(excludeIds) : null;
    const personById = new Map<string, Person>();
    for (const p of persons) {
      personById.set(p.id, p);
    }

    const parentsByChild = new Map<string, Person[]>();
    const spousesByPerson = new Map<string, Person[]>();

    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD') {
        const parent = personById.get(r.fromPersonId);
        if (parent) {
          const list = parentsByChild.get(r.toPersonId);
          if (list) list.push(parent);
          else parentsByChild.set(r.toPersonId, [parent]);
        }
      } else if (r.type === 'SPOUSE') {
        const p1 = personById.get(r.fromPersonId);
        const p2 = personById.get(r.toPersonId);
        if (p1 && p2) {
          const l1 = spousesByPerson.get(p1.id);
          if (l1) l1.push(p2);
          else spousesByPerson.set(p1.id, [p2]);

          const l2 = spousesByPerson.get(p2.id);
          if (l2) l2.push(p1);
          else spousesByPerson.set(p2.id, [p1]);
        }
      }
    }

    const items: IndexedPerson[] = [];
    for (const person of persons) {
      if (excludeSet?.has(person.id)) continue;

      const birthYear = formatShortYearLabel(person.birthDate) || '';
      const city = (person.residence || person.birthPlace || '').split(',')[0].trim();

      const parents = parentsByChild.get(person.id) || [];
      const spouses = spousesByPerson.get(person.id) || [];

      let relationHint = '';
      if (parents.length > 0) {
        const firstParent = parents.find((p) => p.gender === 'male') || parents[0];
        relationHint = `Anak ${firstParent.fullName}`;
      } else if (spouses.length > 0) {
        relationHint = `Pasangan ${spouses[0].fullName}`;
      }

      const subLabel = [relationHint, city].filter(Boolean).join(' · ');
      const normalizedFullName = person.fullName.trim().toLowerCase();
      const firstNameKey = normalizedFullName.split(/\s+/)[0] || '';

      const relatedNames = [...parents, ...spouses].map((p) => p.fullName).join(' ');
      const clusters = trahIndex.personToClusters.get(person.id) || [];
      const trahNames = clusters.map((c) => `${c.name} ${c.relativeLabel || ''}`).join(' ');
      const searchText = `${person.fullName} ${birthYear} ${city} ${relatedNames} ${trahNames}`.toLowerCase();

      items.push({
        person,
        birthYear,
        subLabel,
        clusters,
        searchText,
        normalizedFullName,
        firstNameKey,
      });
    }

    items.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName, 'id'));
    return items;
  }, [persons, relationships, excludeIds, trahIndex]);

  // Multi-token search across full dataset (instant even for thousands of records)
  const trimmedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!trimmedQuery) return indexedPersons;
    const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
    return indexedPersons.filter((item) =>
      tokens.every((token) => item.searchText.includes(token))
    );
  }, [indexedPersons, trimmedQuery]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  // Adaptive disambiguation: count first-name & full-name collisions among visible results
  const nameCollisions = useMemo(() => {
    const fullCounts = new Map<string, number>();
    const firstCounts = new Map<string, number>();
    for (const item of visibleItems) {
      fullCounts.set(item.normalizedFullName, (fullCounts.get(item.normalizedFullName) || 0) + 1);
      if (item.firstNameKey) {
        firstCounts.set(item.firstNameKey, (firstCounts.get(item.firstNameKey) || 0) + 1);
      }
    }
    return { fullCounts, firstCounts };
  }, [visibleItems]);

  const remainingCount = filteredItems.length - visibleItems.length;
  const isSearching = trimmedQuery.length > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={popoverClassName} align={align}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[300px]">
            {visibleItems.length === 0 ? (
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            ) : (
              <CommandGroup>
                {visibleItems.map((item) => {
                  const isSelected = selectedPerson?.id === item.person.id;
                  const hasCollision =
                    (nameCollisions.fullCounts.get(item.normalizedFullName) || 0) > 1 ||
                    (item.firstNameKey !== '' &&
                      (nameCollisions.firstCounts.get(item.firstNameKey) || 0) > 1);
                  const showSubLabel = Boolean(item.subLabel) && (isSearching || hasCollision);

                  return (
                    <CommandItem
                      key={item.person.id}
                      value={item.person.id}
                      onSelect={() => {
                        onSelect(item.person);
                        onOpenChange(false);
                      }}
                      className="flex items-start justify-between gap-2 py-2"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span
                          className={cn(
                            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                            item.person.gender === 'male'
                              ? 'bg-sky-500'
                              : item.person.gender === 'female'
                                ? 'bg-rose-500'
                                : 'bg-muted-foreground'
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm leading-tight font-medium">
                            {item.person.fullName}
                          </div>
                          {showSubLabel && (
                            <div className="truncate text-[11px] leading-snug text-muted-foreground mt-0.5">
                              {item.subLabel}
                            </div>
                          )}
                          {item.clusters.length > 0 && (
                            <TrahBadgeList
                              clusters={item.clusters}
                              variant="compact"
                              maxVisible={2}
                              className="mt-1"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {item.birthYear && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {item.birthYear}
                          </span>
                        )}
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {remainingCount > 0 && (
              <div className="border-t p-1.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-primary hover:bg-muted transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>
                    Tampilkan lebih banyak (+{Math.min(PAGE_SIZE, remainingCount)})
                  </span>
                </button>
                <p className="text-center text-[10px] text-muted-foreground mt-0.5">
                  Menampilkan {visibleItems.length} dari {filteredItems.length} anggota
                </p>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
