import { useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  GitBranch,
  Layers,
  Search,
  Sparkles,
  UserSearch,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PersonPicker } from '@/components/PersonPicker';
import { useFamilyStore } from '@/store/familyStore';
import {
  detectFourGrandparentLines,
  formatShortTrahName,
  getLineagePersonIds,
  GRANDPARENT_SLOT_META,
  LINEAGE_DIRECTION_LABELS,
  type LineageDirection,
} from '@/lib/lineageScope';
import { cn } from '@/lib/utils';

interface LineageScopeSelectorProps {
  /** Total members currently shown under active scope */
  scopedCount?: number;
  /** Compact size for ChartPage toolbar */
  compact?: boolean;
  className?: string;
}

const DIRECTION_OPTIONS: { value: LineageDirection; shortLabel: string; title: string }[] = [
  {
    value: 'extended',
    shortLabel: 'Trah Besar',
    title: 'Keluarga besar dari leluhur tertinggi jalur ini (termasuk saudara kakek/nenek & keturunannya)',
  },
  {
    value: 'both',
    shortLabel: 'Atas & Bawah',
    title: 'Leluhur ke atas + keturunan ke bawah & pasangannya',
  },
  {
    value: 'descendants',
    shortLabel: 'Keturunan',
    title: 'Tokoh ini + semua keturunan & pasangannya',
  },
  {
    value: 'ancestors',
    shortLabel: 'Leluhur',
    title: 'Hanya silsilah leluhur ke atas',
  },
];

export function LineageScopeSelector({
  scopedCount,
  compact = false,
  className,
}: LineageScopeSelectorProps) {
  const {
    persons,
    relationships,
    homePersonId,
    lineageScope,
    pinnedLineageIds,
    setLineageScope,
    resetLineageScope,
    togglePinnedLineage,
  } = useFamilyStore();

  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const personById = useMemo(() => {
    const map = new Map(persons.map((p) => [p.id, p]));
    return map;
  }, [persons]);

  const homePerson = homePersonId ? personById.get(homePersonId) || null : null;

  const grandparentLines = useMemo(
    () => detectFourGrandparentLines(homePersonId, persons, relationships),
    [homePersonId, persons, relationships]
  );

  const pinnedItems = useMemo(() => {
    return pinnedLineageIds
      .map((id) => personById.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((person) => ({
        person,
        memberCount: getLineagePersonIds(person.id, 'both', persons, relationships).size,
      }));
  }, [pinnedLineageIds, personById, persons, relationships]);

  const activeRootPerson =
    lineageScope.type === 'person'
      ? personById.get(lineageScope.rootPersonId) || null
      : null;

  const isScoped = lineageScope.type === 'person' && Boolean(activeRootPerson);
  const activeSlotMeta =
    lineageScope.type === 'person' && lineageScope.slot
      ? GRANDPARENT_SLOT_META[lineageScope.slot]
      : null;

  const activeDirection: LineageDirection =
    lineageScope.type === 'person' ? lineageScope.direction : 'both';

  const isActivePinned =
    activeRootPerson ? pinnedLineageIds.includes(activeRootPerson.id) : false;

  const handleSelectDirection = (direction: LineageDirection) => {
    if (lineageScope.type !== 'person') return;
    setLineageScope({ ...lineageScope, direction });
  };

  if (persons.length === 0) return null;

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isScoped ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'gap-1.5 font-medium transition-colors',
              compact ? 'h-8 rounded-lg px-2.5 text-xs' : 'h-10 rounded-xl px-3 text-xs',
              isScoped
                ? activeSlotMeta
                  ? activeSlotMeta.badgeClass
                  : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border/70 bg-background/85 text-foreground hover:bg-muted/70'
            )}
            title={
              isScoped && activeRootPerson
                ? `Fokus jalur: ${activeRootPerson.fullName} (${LINEAGE_DIRECTION_LABELS[activeDirection]})`
                : 'Filter tampilan berdasarkan jalur kakek-nenek atau tokoh tertentu'
            }
          >
            {isScoped ? (
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  activeSlotMeta ? activeSlotMeta.dotClass : 'bg-primary'
                )}
              />
            ) : (
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}

            <span className="truncate max-w-[130px] sm:max-w-[175px]">
              {isScoped && activeRootPerson
                ? activeRootPerson.fullName
                : 'Semua Jalur'}
            </span>

            {isScoped && typeof scopedCount === 'number' && (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[10px] font-semibold bg-background/70 text-foreground"
              >
                {scopedCount}
              </Badge>
            )}

            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[320px] sm:w-[360px] p-0 overflow-hidden rounded-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Fokus Jalur / Trah
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Saring tampilan tanpa perlu membuat Cabang submission
              </p>
            </div>
            {isScoped && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => {
                  resetLineageScope();
                  setOpen(false);
                }}
              >
                Reset
              </Button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-2.5 space-y-3">
            {/* All Family Option */}
            <button
              type="button"
              onClick={() => {
                resetLineageScope();
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                !isScoped
                  ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                  : 'border-transparent hover:bg-muted/70 text-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5" />
                <span>Semua Keluarga</span>
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{persons.length} org</span>
                {!isScoped && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
            </button>

            {/* Direction selector when a scope is active */}
            {isScoped && activeRootPerson && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Sedang Fokus
                    </p>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {activeRootPerson.fullName}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] gap-1 shrink-0"
                    onClick={() => togglePinnedLineage(activeRootPerson.id)}
                    title={
                      isActivePinned
                        ? 'Hapus dari Trah Favorit'
                        : 'Simpan sebagai shortcut Trah Favorit'
                    }
                  >
                    {isActivePinned ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                        <span>Tersimpan</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3.5 w-3.5" />
                        <span>Simpan</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  {DIRECTION_OPTIONS.map((opt) => {
                    const active = activeDirection === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.title}
                        onClick={() => handleSelectDirection(opt.value)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors border',
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background/80 text-muted-foreground border-border/60 hover:text-foreground'
                        )}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: Auto-detected 4 Grandparent Lines */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  4 Jalur Kakek-Nenek (Otomatis)
                </p>
                {homePerson && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                    Dari: {homePerson.fullName}
                  </span>
                )}
              </div>

              {grandparentLines.length > 0 ? (
                <div className="space-y-1">
                  {grandparentLines.map((line) => {
                    const selected =
                      lineageScope.type === 'person' &&
                      lineageScope.rootPersonId === line.person.id;
                    return (
                      <button
                        key={line.slot}
                        type="button"
                        onClick={() => {
                          setLineageScope({
                            type: 'person',
                            rootPersonId: line.person.id,
                            direction: activeDirection,
                            slot: line.slot,
                          });
                          setOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                          selected
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border/50 bg-background/60 hover:bg-muted/60'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              line.dotClass
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              Trah {formatShortTrahName(line.person.fullName)}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {line.person.fullName} · {line.shortLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {line.memberCount} org
                          </span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  {!homePerson ? (
                    <>
                      Klik <strong>Jadikan Saya</strong> pada profil Anda di Bagan agar 4 jalur kakek-nenek terdeteksi otomatis.
                    </>
                  ) : (
                    <>
                      Belum ada kakek/nenek yang terhubung ke <strong>{homePerson.fullName}</strong>. Tambahkan orang tua dari Ayah/Ibu untuk mengaktifkan 4 jalur otomatis.
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Pinned Favorite Lineages */}
            {pinnedItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <BookmarkCheck className="h-3 w-3 text-primary" />
                  Trah Favorit
                </p>
                <div className="space-y-1">
                  {pinnedItems.map(({ person, memberCount }) => {
                    const selected =
                      lineageScope.type === 'person' &&
                      lineageScope.rootPersonId === person.id;
                    const matchedSlot = grandparentLines.find(
                      (g) => g.person.id === person.id
                    )?.slot;
                    return (
                      <div
                        key={person.id}
                        className={cn(
                          'flex items-center justify-between gap-1 rounded-lg border pr-1 transition-colors',
                          selected
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border/50 bg-background/60 hover:bg-muted/60'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setLineageScope({
                              type: 'person',
                              rootPersonId: person.id,
                              direction: activeDirection,
                              slot: matchedSlot,
                            });
                            setOpen(false);
                          }}
                          className="flex flex-1 min-w-0 items-center justify-between gap-2 px-2.5 py-2 text-left"
                        >
                          <span className="text-xs font-medium text-foreground truncate">
                            {person.fullName}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {memberCount} org
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinnedLineage(person.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Hapus dari Trah Favorit"
                          aria-label={`Hapus ${person.fullName} dari Trah Favorit`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Pick Any Person */}
            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <UserSearch className="h-3 w-3" />
                Fokus dari Tokoh Mana Saja
              </p>
              <PersonPicker
                persons={persons}
                relationships={relationships}
                selectedPerson={activeRootPerson}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                placeholder="Cari nama leluhur / tokoh..."
                popoverClassName="w-[300px] sm:w-[340px] p-0"
                onSelect={(person) => {
                  const matchedSlot = grandparentLines.find(
                    (g) => g.person.id === person.id
                  )?.slot;
                  setLineageScope({
                    type: 'person',
                    rootPersonId: person.id,
                    direction: 'both',
                    slot: matchedSlot,
                  });
                  setPickerOpen(false);
                  setOpen(false);
                }}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-9 rounded-lg text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        Pilih orang untuk fokus pohonnya...
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </Button>
                }
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick one-click clear button when scoped */}
      {isScoped && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={resetLineageScope}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-foreground',
            compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
          )}
          title="Tampilkan semua jalur"
          aria-label="Tampilkan semua jalur"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
