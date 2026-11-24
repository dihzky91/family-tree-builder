import { useEffect, useRef, useCallback, useState } from 'react';
import * as f3 from 'family-chart';
import {
  Crosshair,
  ZoomIn,
  ZoomOut,
  ArrowDownUp,
  ArrowLeftRight,
  Users,
  House,
  Pin,
  Layers,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FamilyChartDatum } from '../utils/familyChartMapper';
import type { Person } from '@/types';
import { toast } from 'sonner';
import 'family-chart/styles/family-chart.css';
import './family-chart.css';

interface FamilyStatsSummary {
  parents: number;
  spouses: number;
  children: number;
  siblings: number;
}

interface FamilyMainViewProps {
  data: FamilyChartDatum[];
  rootId: string;
  rootPerson: Person;
  homePerson?: Person | null;
  onSetHomePerson?: (id: string) => void;
  summary?: FamilyStatsSummary;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (id: string) => void;
}

interface TreeDatumLike {
  data: FamilyChartDatum & { main?: boolean };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function FamilyMainView({
  data,
  rootId,
  rootPerson,
  homePerson,
  onSetHomePerson,
  summary,
  onSelectPerson,
  onAddRelationship,
}: FamilyMainViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [showSiblings, setShowSiblings] = useState(true);
  // Default to 1 generation (parents + siblings + spouse + children) like MyHeritage "Generations: 1"
  const [generationDepth, setGenerationDepth] = useState<'1' | '2' | 'all'>('1');

  const isRootHome = Boolean(homePerson && homePerson.id === rootId);

  const handleFitTree = useCallback(() => {
    chartRef.current?.updateTree({ initial: false, tree_position: 'fit' });
  }, []);

  const handleCenterOnMain = useCallback(() => {
    chartRef.current?.updateTree({ initial: false, tree_position: 'main_to_middle' });
  }, []);

  const handleGoHome = useCallback(() => {
    if (!homePerson) return;
    onSelectPerson(homePerson.id);
    chartRef.current?.updateMainId(homePerson.id);
    chartRef.current?.updateTree({ initial: false, tree_position: 'fit' });
  }, [homePerson, onSelectPerson]);

  const handlePinAsHome = useCallback(() => {
    if (!onSetHomePerson) return;
    onSetHomePerson(rootPerson.id);
    toast.success(`${rootPerson.fullName} dijadikan Figur Utama (Saya)`);
  }, [onSetHomePerson, rootPerson]);

  const handleZoomStep = useCallback((direction: 'in' | 'out') => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: direction === 'in' ? -180 : 180,
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    svg.dispatchEvent(wheelEvent);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data.length || !rootId) return;

    container.innerHTML = '';

    const f3Chart = f3
      .createChart(container, data as unknown as f3.Data)
      .setTransitionTime(420)
      .setCardXSpacing(orientation === 'vertical' ? 255 : 270)
      .setCardYSpacing(orientation === 'vertical' ? 136 : 118)
      .setSingleParentEmptyCard(false)
      .setShowSiblingsOfMain(showSiblings);

    if (generationDepth === '1') {
      f3Chart.setAncestryDepth(1).setProgenyDepth(1);
    } else if (generationDepth === '2') {
      f3Chart.setAncestryDepth(2).setProgenyDepth(2);
    }

    if (orientation === 'horizontal') {
      f3Chart.setOrientationHorizontal();
    } else {
      f3Chart.setOrientationVertical();
    }

    chartRef.current = f3Chart;

    const f3Card = f3Chart
      .setCardHtml()
      .setCardDim({ w: 226, h: 82 })
      .setMiniTree(false)
      .setOnHoverPathToMain()
      .setCardInnerHtmlCreator((treeDatum: unknown) => {
        const d = (treeDatum as TreeDatumLike).data;
        const fullName =
          d.data.label ||
          `${d.data['first name'] || ''} ${d.data['last name'] || ''}`.trim() ||
          '-';
        const safeName = escapeHtml(fullName);
        const initials = escapeHtml(getInitials(fullName));
        const genderClass =
          d.data.rawGender === 'male'
            ? 'male'
            : d.data.rawGender === 'female'
              ? 'female'
              : 'unknown';
        const isRoot = d.id === rootId || Boolean(d.main);
        const isHome = Boolean(homePerson && d.id === homePerson.id);
        const hasParents = Array.isArray(d.rels?.parents) && d.rels.parents.length > 0;
        const childCount = Array.isArray(d.rels?.children) ? d.rels.children.length : 0;

        const bYear = d.data.birthYearNum ? escapeHtml(d.data.birthYearNum) : '';
        const dYear = d.data.deathYearNum ? escapeHtml(d.data.deathYearNum) : '';
        const lifespan =
          bYear && dYear
            ? `${bYear} – ${dYear}`
            : bYear
              ? `Lahir ${bYear}`
              : dYear
                ? `Wafat ${dYear}`
                : 'Tahun belum tercatat';

        const residence = d.data.residence ? escapeHtml(d.data.residence) : '';
        const verifiedSvg = d.data.verified
          ? `<svg class="ft-verified" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Terverifikasi"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
          : '';

        return `
          <div class="ft-card ${genderClass} ${isRoot ? 'is-root' : ''}" data-person-id="${escapeHtml(d.id)}">
            ${
              hasParents
                ? `<div class="ft-parents-dot" title="Memiliki data orang tua">
                    <span style="background:hsl(var(--node-male))"></span>
                    <span style="background:hsl(var(--node-female))"></span>
                  </div>`
                : ''
            }
            <div class="ft-avatar">
              ${
                d.data.avatar
                  ? `<img src="${escapeHtml(d.data.avatar)}" alt="${safeName}" />`
                  : `<span>${initials}</span>`
              }
            </div>
            <div class="ft-body">
              <div class="ft-name-row">
                <div class="ft-name" title="${safeName}">${safeName}</div>
                ${verifiedSvg}
                ${isHome ? `<span class="ft-you-badge" title="Akun Saya / Figur Utama">Saya</span>` : ''}
              </div>
              <div class="ft-lifespan">${lifespan}</div>
              ${
                childCount > 0 || residence
                  ? `<div class="ft-submeta">
                      ${childCount > 0 ? `<span class="ft-pill">${childCount} anak</span>` : ''}
                      ${residence ? `<span class="ft-pill">${residence}</span>` : ''}
                    </div>`
                  : ''
              }
            </div>
            ${
              onAddRelationship
                ? `<button
                    type="button"
                    class="ft-add-btn"
                    data-action="add"
                    data-id="${escapeHtml(d.id)}"
                    title="Tambah kerabat untuk ${safeName}"
                    aria-label="Tambah kerabat untuk ${safeName}"
                  >
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                      <path d="M7 2.5v9M2.5 7h9" />
                    </svg>
                  </button>`
                : ''
            }
          </div>
        `;
      });

    f3Card.setOnCardClick((e: MouseEvent, treeDatum: unknown) => {
      const target = e.target as HTMLElement;
      const addBtn = target.closest('[data-action="add"]') as HTMLElement | null;
      if (addBtn) {
        e.stopPropagation();
        const id = addBtn.dataset.id;
        if (id && onAddRelationship) onAddRelationship(id);
        return;
      }

      const d = (treeDatum as TreeDatumLike)?.data;
      if (d?.id) {
        onSelectPerson(d.id);
        f3Card.onCardClickDefault(e, treeDatum as Parameters<typeof f3Card.onCardClickDefault>[1]);
      }
    });

    f3Chart.updateMainId(rootId);
    f3Chart.updateTree({ initial: true, tree_position: 'fit' });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        chartRef.current?.updateTree({ initial: false, tree_position: 'fit' });
      }, 180);
    });
    resizeObserver.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      container.innerHTML = '';
    };
  }, [data, rootId, homePerson, orientation, showSiblings, generationDepth, onSelectPerson, onAddRelationship]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Floating Top Bar: Focus Pill + Layout Toggles (stacks cleanly in 2 rows on mobile, single row on sm+) */}
      <div
        data-export-ignore="true"
        className="pointer-events-none absolute inset-x-2.5 top-2.5 sm:inset-x-3 sm:top-3 z-10 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between"
      >
        {/* Focus Pill */}
        <div className="pointer-events-auto flex max-w-full self-start items-center gap-2 rounded-2xl border border-border/70 bg-background/90 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 shadow-sm backdrop-blur-md">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary overflow-hidden border border-primary/20">
            {rootPerson.photoUrl ? (
              <img
                src={rootPerson.photoUrl}
                alt={rootPerson.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(rootPerson.fullName)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground leading-none">
                Figur Pusat
              </p>
              {isRootHome && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Ini Saya
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold text-foreground max-w-[180px] sm:max-w-[220px]">
              {rootPerson.fullName}
            </p>
          </div>
          {summary && (
            <div className="hidden xl:flex items-center gap-1.5 border-l border-border/70 pl-2.5 text-[11px] text-muted-foreground">
              <span className="rounded-full bg-muted/60 px-2 py-0.5">{summary.parents} ortu</span>
              <span className="rounded-full bg-muted/60 px-2 py-0.5">
                {summary.spouses} pasangan
              </span>
              <span className="rounded-full bg-muted/60 px-2 py-0.5">{summary.children} anak</span>
              {summary.siblings > 0 && (
                <span className="rounded-full bg-muted/60 px-2 py-0.5">
                  {summary.siblings} saudara
                </span>
              )}
            </div>
          )}

          {/* Pin as Home ("Jadikan Saya") or Return to Home ("Kembali ke Saya") */}
          {!isRootHome && (homePerson || onSetHomePerson) && (
            <div className="flex items-center gap-1 border-l border-border/70 pl-2">
              {homePerson && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGoHome}
                  className="h-7 gap-1 rounded-lg px-2 text-[11px] font-medium text-primary hover:bg-primary/10 hover:text-primary"
                  title={`Kembali ke figur utama (${homePerson.fullName})`}
                >
                  <House className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Saya</span>
                </Button>
              )}
              {onSetHomePerson && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePinAsHome}
                  className="h-7 gap-1 rounded-lg px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  title={`Jadikan ${rootPerson.fullName} sebagai Figur Utama default (Ini Saya)`}
                >
                  <Pin className="h-3 w-3" />
                  <span className="hidden md:inline">Set Utama</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Layout Toggles (Generations + Siblings + Vertical/Horizontal) */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {/* Generation Depth Filter (MyHeritage-style "Generations: 1 / 2 / Semua") */}
          <div
            className="flex items-center rounded-xl border border-border/70 bg-background/90 p-0.5 shadow-sm backdrop-blur-md"
            title="Jumlah generasi yang ditampilkan dari figur pusat"
          >
            <span className="hidden lg:inline-flex items-center gap-1 pl-2 pr-1.5 text-[11px] font-medium text-muted-foreground">
              <Layers className="h-3 w-3" />
              Gen:
            </span>
            {(
              [
                { value: '1', label: '1 Gen', title: 'Keluarga inti (Orang tua, Saudara, Pasangan & Anak)' },
                { value: '2', label: '2 Gen', title: '2 generasi ke atas & ke bawah (Kakek-Nenek hingga Cucu)' },
                { value: 'all', label: 'Semua', title: 'Tampilkan seluruh generasi' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGenerationDepth(opt.value)}
                title={opt.title}
                className={cn(
                  'flex h-7 items-center rounded-lg px-2 text-[11px] font-medium transition-colors',
                  generationDepth === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant={showSiblings ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 gap-1.5 rounded-xl border-border/70 bg-background/90 px-2.5 text-[11px] shadow-sm backdrop-blur-md"
            onClick={() => setShowSiblings((prev) => !prev)}
            title="Tampilkan atau sembunyikan saudara kandung figur pusat"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Saudara</span>
          </Button>

          <div className="flex items-center rounded-xl border border-border/70 bg-background/90 p-0.5 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => setOrientation('vertical')}
              className={cn(
                'flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
                orientation === 'vertical'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Tata letak vertikal (atas ke bawah)"
            >
              <ArrowDownUp className="h-3 w-3" />
              <span className="hidden md:inline">Vertikal</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientation('horizontal')}
              className={cn(
                'flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
                orientation === 'horizontal'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Tata letak horizontal (kiri ke kanan)"
            >
              <ArrowLeftRight className="h-3 w-3" />
              <span className="hidden md:inline">Horizontal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Full-Viewport Tree Stage */}
      <div ref={containerRef} className="f3 family-stage" />

      {/* Floating Bottom-Right Zoom & Fit Controls */}
      <div
        data-export-ignore="true"
        className="absolute bottom-3 right-3 z-10 flex items-center rounded-xl border border-border/70 bg-background/88 p-0.5 shadow-sm backdrop-blur-md"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => handleZoomStep('out')}
          title="Perkecil"
          aria-label="Perkecil pohon keluarga"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={handleCenterOnMain}
          title="Pusatkan ke Figur Pusat"
          aria-label="Pusatkan ke Figur Pusat"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={handleFitTree}
          title="Sesuaikan seluruh bagan ke layar (Fit)"
          aria-label="Sesuaikan layar"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={() => handleZoomStep('in')}
          title="Perbesar"
          aria-label="Perbesar pohon keluarga"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Subtle Bottom-Left Hint */}
      <div
        data-export-ignore="true"
        className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:block rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md"
      >
        Hover kartu untuk sorot jalur · Klik untuk pindah fokus · Drag & Scroll untuk navigasi
      </div>
    </div>
  );
}
