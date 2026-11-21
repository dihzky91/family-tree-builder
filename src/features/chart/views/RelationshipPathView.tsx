import { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowLeftRight,
  Crown,
  GitMerge,
  Search,
  Users,
  Layers,
  Route,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportTreeAsImage } from '@/features/chart/utils/exportTreeAsImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { calculateRelationship } from '@/lib/relationshipCalculator';
import { RelationshipPathGraph } from '@/features/relationships/RelationshipPathGraph';
import type { Person, Relationship } from '@/types';
import { cn } from '@/lib/utils';

interface RelationshipPathViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

export function RelationshipPathView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: RelationshipPathViewProps) {
  const [personAId, setPersonAId] = useState<string | null>(selectedPersonId);
  const [personBId, setPersonBId] = useState<string | null>(null);
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const exportAreaRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const handleExport = (format: 'png' | 'svg') => {
    if (!exportAreaRef.current) return;
    void exportTreeAsImage(exportAreaRef.current, {
      format,
      filename: 'jalur-hubungan-keluarga',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      scale: 2,
    });
  };

  // Sync Person A when user selects a person from chart search and A isn't set yet
  useEffect(() => {
    if (!personAId && selectedPersonId) {
      setPersonAId(selectedPersonId);
    }
  }, [selectedPersonId, personAId]);

  // Default smart pair on first open so canvas isn't blank
  useEffect(() => {
    if (persons.length < 2 || (personAId && personBId)) return;

    const startId = personAId || selectedPersonId || persons[0].id;
    if (!personAId) setPersonAId(startId);

    if (!personBId) {
      // Pick someone connected (prefer 2-4 steps away if possible, else any connected person)
      let bestCandidate: string | null = null;
      let bestScore = -1;
      for (const candidate of persons) {
        if (candidate.id === startId) continue;
        const res = calculateRelationship(startId, candidate.id, persons, relationships);
        if (!res) continue;
        const score = res.stepsCount >= 2 && res.stepsCount <= 4 ? 10 + res.stepsCount : res.stepsCount;
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate.id;
        }
      }
      setPersonBId(bestCandidate || persons.find((p) => p.id !== startId)?.id || null);
    }
  }, [persons, relationships, selectedPersonId, personAId, personBId]);

  const personA = useMemo(
    () => persons.find((p) => p.id === personAId) || null,
    [persons, personAId]
  );
  const personB = useMemo(
    () => persons.find((p) => p.id === personBId) || null,
    [persons, personBId]
  );

  const result = useMemo(() => {
    if (!personA || !personB || personA.id === personB.id) return null;
    return calculateRelationship(personA.id, personB.id, persons, relationships);
  }, [personA, personB, persons, relationships]);

  const handleSwap = () => {
    setPersonAId(personBId);
    setPersonBId(personAId);
  };

  const renderPicker = (
    label: string,
    selected: Person | null,
    onChange: (id: string) => void,
    open: boolean,
    setOpen: (v: boolean) => void,
    accentClass: string
  ) => (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 min-w-[180px] max-w-[240px] flex-1 justify-between gap-2 rounded-lg bg-background/90 px-2.5 text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                accentClass
              )}
            >
              {label}
            </span>
            <span className="truncate font-medium">
              {selected ? selected.fullName : `Pilih Orang ${label}...`}
            </span>
          </div>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari nama anggota..." />
          <CommandList>
            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {persons.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.fullName}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        p.gender === 'male'
                          ? 'bg-sky-500'
                          : p.gender === 'female'
                            ? 'bg-rose-500'
                            : 'bg-muted-foreground'
                      )}
                    />
                    <span className="truncate">{p.fullName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const commonAncestor =
    result && result.commonAncestorIndex !== null
      ? result.path[result.commonAncestorIndex]?.person
      : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/85 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          {renderPicker('A', personA, setPersonAId, openA, setOpenA, 'bg-primary')}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full border border-border/60"
            onClick={handleSwap}
            title="Tukar posisi A dan B"
            aria-label="Tukar posisi A dan B"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>

          {renderPicker('B', personB, setPersonBId, openB, setOpenB, 'bg-emerald-600')}
        </div>

        {result && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Route className="h-3 w-3" />
              {result.stepsCount} langkah
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <Layers className="h-3 w-3" />
              {result.generationDiff === 0
                ? '1 generasi'
                : `${Math.abs(result.generationDiff)} gen ${result.generationDiff < 0 ? 'di atas' : 'di bawah'}`}
            </Badge>
            {commonAncestor && (
              <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 text-[11px]">
                <Crown className="h-3 w-3" />
                Leluhur Bersama: {commonAncestor.fullName}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs bg-background/90">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleExport('png')} className="text-xs">
                  Simpan PNG (HD)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('svg')} className="text-xs">
                  Simpan SVG (Vektor)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {!personA || !personB ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <GitMerge className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">
              Pilih dua anggota keluarga
            </p>
            <p className="mt-1 text-xs">
              Tampilkan grafik jalur kekerabatan terpendek di antara keduanya.
            </p>
          </div>
        ) : personA.id === personB.id ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">Orang yang sama dipilih</p>
            <p className="mt-1 text-xs">Pilih dua anggota yang berbeda untuk melihat jalur hubungan.</p>
          </div>
        ) : result ? (
          <div
            ref={exportAreaRef}
            data-export-target="true"
            className="mx-auto max-w-6xl space-y-5 p-2 rounded-xl"
          >
            {/* Summary Banner */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {personB.fullName} terhadap {personA.fullName}
                </p>
                <p className="mt-1 text-xl font-display font-bold text-primary">
                  {result.term}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {personA.fullName} terhadap {personB.fullName}
                </p>
                <p className="mt-1 text-xl font-display font-bold text-emerald-700 dark:text-emerald-400">
                  {result.reverseTerm}
                </p>
              </div>
            </div>

            {/* Interactive Graph */}
            <RelationshipPathGraph
              result={result}
              onSelectPerson={onSelectPerson}
            />

            <p className="text-center text-xs text-muted-foreground">
              Klik kartu anggota mana saja untuk melihat profil lengkapnya di panel kanan.
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">
              Tidak ada jalur hubungan yang ditemukan
            </p>
            <p className="mt-1 max-w-sm text-xs">
              <strong>{personA.fullName}</strong> dan <strong>{personB.fullName}</strong> belum terhubung dalam silsilah saat ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
