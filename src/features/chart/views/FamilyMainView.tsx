import { useEffect, useRef, useCallback, useState } from 'react';
import * as f3 from 'family-chart';
import { Crosshair, ZoomIn, ZoomOut, ArrowDownUp, ArrowLeftRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FamilyChartDatum } from '../utils/familyChartMapper';
import type { Person } from '@/types';
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
  summary?: FamilyStatsSummary;
  onSelectPerson: (id: string) => void;
  onAddRelationship: (id: string) => void;
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
  summary,
  onSelectPerson,
  onAddRelationship,
}: FamilyMainViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [showSiblings, setShowSiblings] = useState(true);

  const handleFitTree = useCallback(() => {
    chartRef.current?.updateTree({ initial: false, tree_position: 'fit' });
  }, []);

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
      .setTransitionTime(450)
      .setCardXSpacing(orientation === 'vertical' ? 255 : 270)
      .setCardYSpacing(orientation === 'vertical' ? 132 : 115)
      .setShowSiblingsOfMain(showSiblings);

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
            <button
              type="button"
              class="ft-add-btn"
              data-action="add"
              data-id="${escapeHtml(d.id)}"
              title="Tambah relasi untuk ${safeName}"
            >+</button>
          </div>
        `;
      });

    f3Card.setOnCardClick((e: MouseEvent, treeDatum: unknown) => {
      const target = e.target as HTMLElement;
      const addBtn = target.closest('[data-action="add"]') as HTMLElement | null;
      if (addBtn) {
        e.stopPropagation();
        const id = addBtn.dataset.id;
        if (id) onAddRelationship(id);
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
  }, [data, rootId, orientation, showSiblings, onSelectPerson, onAddRelationship]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Floating Focus Pill (top-left) */}
      <div
        data-export-ignore="true"
        className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-12rem)] flex-wrap items-center gap-2"
      >
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-border/70 bg-background/88 px-3 py-1.5 shadow-sm backdrop-blur-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary overflow-hidden border border-primary/20">
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
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground leading-none">
              Figur Pusat
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-foreground max-w-[160px] sm:max-w-[220px]">
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
        </div>
      </div>

      {/* Floating Top-Right Layout Toggles (Vertical/Horizontal + Siblings) */}
      <div
        data-export-ignore="true"
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5"
      >
        <Button
          variant={showSiblings ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 rounded-xl border-border/70 bg-background/88 px-2.5 text-[11px] shadow-sm backdrop-blur-md"
          onClick={() => setShowSiblings((prev) => !prev)}
          title="Tampilkan atau sembunyikan saudara kandung figur pusat"
        >
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Saudara</span>
        </Button>

        <div className="flex items-center rounded-xl border border-border/70 bg-background/88 p-0.5 shadow-sm backdrop-blur-md">
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
          onClick={handleFitTree}
          title="Sesuaikan layar (Fit)"
          aria-label="Sesuaikan layar"
        >
          <Crosshair className="h-3.5 w-3.5" />
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
