import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  MapPin,
  Layers,
  Play,
  Pause,
  Users,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { Person, Relationship } from '@/types';

interface ParticleSankeyViewProps {
  persons: Person[];
  relationships: Relationship[];
  onSelectPerson?: (personId: string) => void;
  selectedPersonId?: string | null;
}

type FlowMode = 'gen_flow' | 'branch_status' | 'migration';

interface SankeyNode {
  id: string;
  label: string;
  column: number;
  count: number;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  members: Person[];
}

interface SankeyLink {
  id: string;
  sourceId: string;
  targetId: string;
  value: number;
  color: string;
  sy0: number;
  sy1: number;
  ty0: number;
  ty1: number;
  sx: number;
  tx: number;
}

interface FlowParticle {
  linkIndex: number;
  t: number;
  speed: number;
  offset: number; // -0.45..0.45 across ribbon thickness
  size: number;
}

const FLOW_PALETTE = [
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#14b8a6',
];

function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[1][0]}.`;
}

function extractCity(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'Belum Diisi';
  const cleaned = raw.trim().split(',')[0].trim();
  if (!cleaned) return 'Belum Diisi';
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function cubicBezierPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const x = mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3;
  const y = mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3;
  return { x, y };
}

export function ParticleSankeyView({
  persons,
  relationships,
  onSelectPerson,
}: ParticleSankeyViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isMobile = useIsMobile();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<FlowParticle[]>([]);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredLinkIdRef = useRef<string | null>(null);

  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [flowMode, setFlowMode] = useState<FlowMode>('gen_flow');
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<SankeyNode | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    title: string;
    subtitle: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build Sankey columns, nodes, and links
  const { nodes, links, columnHeaders } = useMemo(() => {
    const { width, height } = dimensions;
    const personMap = new Map(persons.map((p) => [p.id, p]));
    const parentsByChild = new Map<string, string[]>();
    const childrenByParent = new Map<string, string[]>();
    const spousesByPerson = new Map<string, string[]>();

    relationships.forEach((rel) => {
      if (!personMap.has(rel.fromPersonId) || !personMap.has(rel.toPersonId)) return;
      if (rel.type === 'PARENT_CHILD') {
        const pl = parentsByChild.get(rel.toPersonId) || [];
        pl.push(rel.fromPersonId);
        parentsByChild.set(rel.toPersonId, pl);

        const cl = childrenByParent.get(rel.fromPersonId) || [];
        cl.push(rel.toPersonId);
        childrenByParent.set(rel.fromPersonId, cl);
      } else if (rel.type === 'SPOUSE') {
        const s1 = spousesByPerson.get(rel.fromPersonId) || [];
        s1.push(rel.toPersonId);
        spousesByPerson.set(rel.fromPersonId, s1);

        const s2 = spousesByPerson.get(rel.toPersonId) || [];
        s2.push(rel.fromPersonId);
        spousesByPerson.set(rel.toPersonId, s2);
      }
    });

    // Generation calculation
    const genCache = new Map<string, number>();
    const getGen = (id: string, visited = new Set<string>()): number => {
      if (genCache.has(id)) return genCache.get(id)!;
      if (visited.has(id)) return 1;
      const next = new Set(visited);
      next.add(id);
      const parents = parentsByChild.get(id) || [];
      if (parents.length === 0) {
        genCache.set(id, 1);
        return 1;
      }
      const g = Math.max(...parents.map((pid) => getGen(pid, next))) + 1;
      genCache.set(id, g);
      return g;
    };
    persons.forEach((p) => getGen(p.id));
    persons.forEach((p) => {
      if ((parentsByChild.get(p.id) || []).length === 0) {
        const sg = (spousesByPerson.get(p.id) || [])
          .filter((sid) => (parentsByChild.get(sid) || []).length > 0)
          .map((sid) => genCache.get(sid) || 1);
        if (sg.length > 0) genCache.set(p.id, Math.max(...sg));
      }
    });

    // Primary branch
    const rootSet = new Set(
      persons
        .filter((p) => (genCache.get(p.id) || 1) === 1 && (childrenByParent.get(p.id) || []).length > 0)
        .map((p) => p.id)
    );
    const branchCache = new Map<string, string>();
    const getBranch = (id: string, visited = new Set<string>()): string => {
      if (branchCache.has(id)) return branchCache.get(id)!;
      if (visited.has(id)) return 'Keluarga Inti';
      const next = new Set(visited);
      next.add(id);
      const g = genCache.get(id) || 1;
      if (g === 1) {
        branchCache.set(id, 'Leluhur Utama');
        return 'Leluhur Utama';
      }
      const parents = parentsByChild.get(id) || [];
      if (g === 2 && parents.some((pid) => rootSet.has(pid))) {
        const label = getShortName(personMap.get(id)?.fullName || 'Cabang');
        branchCache.set(id, label);
        return label;
      }
      if (parents.length > 0) {
        const pb = getBranch(parents[0], next);
        branchCache.set(id, pb);
        return pb;
      }
      for (const sid of spousesByPerson.get(id) || []) {
        if ((parentsByChild.get(sid) || []).length > 0) {
          const sb = getBranch(sid, next);
          branchCache.set(id, sb);
          return sb;
        }
      }
      branchCache.set(id, 'Cabang Lainnya');
      return 'Cabang Lainnya';
    };

    // Keep top 6 branches so Sankey stays clean
    const branchCounts = new Map<string, number>();
    persons.forEach((p) => {
      const b = getBranch(p.id);
      branchCounts.set(b, (branchCounts.get(b) || 0) + 1);
    });
    const topBranches = new Set(
      Array.from(branchCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([b]) => b)
    );
    const normBranch = (id: string) => {
      const b = getBranch(id);
      return topBranches.has(b) ? b : 'Cabang Lainnya';
    };

    const branchColorMap = new Map<string, string>();
    Array.from(topBranches).forEach((b, idx) => {
      branchColorMap.set(b, FLOW_PALETTE[idx % FLOW_PALETTE.length]);
    });
    branchColorMap.set('Cabang Lainnya', '#94a3b8');

    // Construct raw nodes & links depending on mode
    const rawNodeMap = new Map<
      string,
      { id: string; label: string; column: number; color: string; members: Person[] }
    >();
    const rawLinkMap = new Map<string, { sourceId: string; targetId: string; value: number; color: string }>();
    let headers: string[] = [];

    const ensureNode = (id: string, label: string, column: number, color: string, person: Person) => {
      let n = rawNodeMap.get(id);
      if (!n) {
        n = { id, label, column, color, members: [] };
        rawNodeMap.set(id, n);
      }
      if (!n.members.some((m) => m.id === person.id)) {
        n.members.push(person);
      }
      return n;
    };

    const addLink = (sourceId: string, targetId: string, color: string) => {
      const key = `${sourceId}__${targetId}`;
      const existing = rawLinkMap.get(key);
      if (existing) {
        existing.value += 1;
      } else {
        rawLinkMap.set(key, { sourceId, targetId, value: 1, color });
      }
    };

    if (flowMode === 'gen_flow') {
      const gens = Array.from(new Set(persons.map((p) => genCache.get(p.id) || 1))).sort((a, b) => a - b);
      const colIndexByGen = new Map(gens.map((g, i) => [g, i]));
      headers = gens.map((g) => `Gen ${g}`);

      persons.forEach((p) => {
        const g = genCache.get(p.id) || 1;
        const col = colIndexByGen.get(g) ?? 0;
        const b = g === 1 ? 'Leluhur Utama' : normBranch(p.id);
        const color = g === 1 ? '#f59e0b' : branchColorMap.get(b) || '#3b82f6';
        ensureNode(`g${g}_${b}`, b, col, color, p);
      });

      // Connect each person with parent in earlier gen
      persons.forEach((p) => {
        const g = genCache.get(p.id) || 1;
        const parents = parentsByChild.get(p.id) || [];
        if (parents.length === 0) return;
        const pid = parents[0];
        const pg = genCache.get(pid) || 1;
        if (pg >= g) return;
        const pb = pg === 1 ? 'Leluhur Utama' : normBranch(pid);
        const cb = g === 1 ? 'Leluhur Utama' : normBranch(p.id);
        const color = branchColorMap.get(cb) || '#3b82f6';
        addLink(`g${pg}_${pb}`, `g${g}_${cb}`, color);
      });
    } else if (flowMode === 'branch_status') {
      headers = ['Cabang Trah', 'Generasi', 'Gender & Status'];
      persons.forEach((p) => {
        const b = normBranch(p.id);
        const g = genCache.get(p.id) || 1;
        const gLabel = `Generasi ${g}`;
        const statusLabel = p.deathDate
          ? 'Almarhum/ah'
          : p.gender === 'male'
            ? 'Laki-laki (Hidup)'
            : p.gender === 'female'
              ? 'Perempuan (Hidup)'
              : 'Lainnya (Hidup)';

        const bColor = branchColorMap.get(b) || '#3b82f6';
        const gColor = FLOW_PALETTE[(g - 1) % FLOW_PALETTE.length];
        const sColor = p.deathDate
          ? '#94a3b8'
          : p.gender === 'male'
            ? '#3b82f6'
            : p.gender === 'female'
              ? '#ec4899'
              : '#8b5cf6';

        ensureNode(`b_${b}`, b, 0, bColor, p);
        ensureNode(`gen_${g}`, gLabel, 1, gColor, p);
        ensureNode(`st_${statusLabel}`, statusLabel, 2, sColor, p);

        addLink(`b_${b}`, `gen_${g}`, bColor);
        addLink(`gen_${g}`, `st_${statusLabel}`, sColor);
      });
    } else {
      // migration: Birth Place -> Current Residence
      headers = ['Tempat Lahir', 'Domisili Sekarang'];
      const cityCount = new Map<string, number>();
      persons.forEach((p) => {
        const bp = extractCity(p.birthPlace);
        const res = extractCity(p.residence || p.birthPlace);
        if (bp !== 'Belum Diisi') cityCount.set(bp, (cityCount.get(bp) || 0) + 1);
        if (res !== 'Belum Diisi') cityCount.set(res, (cityCount.get(res) || 0) + 1);
      });
      const topCities = new Set(
        Array.from(cityCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7)
          .map(([c]) => c)
      );
      const normCity = (raw?: string | null) => {
        const c = extractCity(raw);
        if (c === 'Belum Diisi') return 'Belum Diisi';
        return topCities.has(c) ? c : 'Kota Lainnya';
      };
      const cityColorMap = new Map<string, string>();
      Array.from(topCities).forEach((c, i) => cityColorMap.set(c, FLOW_PALETTE[i % FLOW_PALETTE.length]));
      cityColorMap.set('Kota Lainnya', '#64748b');
      cityColorMap.set('Belum Diisi', '#94a3b8');

      persons.forEach((p) => {
        const fromCity = normCity(p.birthPlace);
        const toCity = normCity(p.residence || p.birthPlace);
        const c1 = cityColorMap.get(fromCity) || '#3b82f6';
        const c2 = cityColorMap.get(toCity) || '#10b981';

        ensureNode(`from_${fromCity}`, fromCity, 0, c1, p);
        ensureNode(`to_${toCity}`, toCity, 1, c2, p);
        addLink(`from_${fromCity}`, `to_${toCity}`, c1);
      });
    }

    // Layout columns cleanly
    const colCount = Math.max(1, headers.length);
    const padLeft = isMobile ? 16 : 36;
    const padRight = isMobile ? 16 : 36;
    const padTop = 94;
    const padBottom = 46;
    const nodeW = isMobile ? 14 : 18;
    const usableW = Math.max(200, width - padLeft - padRight - nodeW);
    const usableH = Math.max(220, height - padTop - padBottom);

    const nodesByCol = new Map<number, typeof rawNodeMap extends Map<string, infer V> ? V[] : never>();
    rawNodeMap.forEach((n) => {
      const list = nodesByCol.get(n.column) || [];
      list.push(n);
      nodesByCol.set(n.column, list);
    });

    const positionedNodes = new Map<string, SankeyNode>();
    for (let col = 0; col < colCount; col++) {
      const list = (nodesByCol.get(col) || []).sort((a, b) => b.members.length - a.members.length);
      const totalVal = Math.max(
        1,
        list.reduce((sum, n) => sum + n.members.length, 0)
      );
      const gap = Math.min(18, Math.max(8, usableH * 0.16 / Math.max(1, list.length)));
      const availH = Math.max(80, usableH - gap * Math.max(0, list.length - 1));
      const x = colCount === 1 ? padLeft + usableW / 2 : padLeft + (col / (colCount - 1)) * usableW;

      let cursorY = padTop;
      list.forEach((item) => {
        const h = Math.max(14, (item.members.length / totalVal) * availH);
        positionedNodes.set(item.id, {
          id: item.id,
          label: item.label,
          column: item.column,
          count: item.members.length,
          color: item.color,
          x,
          y: cursorY,
          w: nodeW,
          h,
          members: item.members,
        });
        cursorY += h + gap;
      });
    }

    // Compute ribbon vertical slices on each node
    const outOffsets = new Map<string, number>();
    const inOffsets = new Map<string, number>();
    const outTotals = new Map<string, number>();
    const inTotals = new Map<string, number>();

    rawLinkMap.forEach((l) => {
      outTotals.set(l.sourceId, (outTotals.get(l.sourceId) || 0) + l.value);
      inTotals.set(l.targetId, (inTotals.get(l.targetId) || 0) + l.value);
    });

    const positionedLinks: SankeyLink[] = [];
    Array.from(rawLinkMap.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .forEach(([id, l]) => {
        const sNode = positionedNodes.get(l.sourceId);
        const tNode = positionedNodes.get(l.targetId);
        if (!sNode || !tNode) return;

        const sTotal = Math.max(1, outTotals.get(l.sourceId) || l.value);
        const tTotal = Math.max(1, inTotals.get(l.targetId) || l.value);

        const sUsed = outOffsets.get(l.sourceId) || 0;
        const tUsed = inOffsets.get(l.targetId) || 0;

        const sThickness = (l.value / sTotal) * sNode.h;
        const tThickness = (l.value / tTotal) * tNode.h;

        outOffsets.set(l.sourceId, sUsed + sThickness);
        inOffsets.set(l.targetId, tUsed + tThickness);

        positionedLinks.push({
          id,
          sourceId: l.sourceId,
          targetId: l.targetId,
          value: l.value,
          color: l.color,
          sx: sNode.x + sNode.w,
          tx: tNode.x,
          sy0: sNode.y + sUsed,
          sy1: sNode.y + sUsed + sThickness,
          ty0: tNode.y + tUsed,
          ty1: tNode.y + tUsed + tThickness,
        });
      });

    return {
      nodes: Array.from(positionedNodes.values()),
      links: positionedLinks,
      columnHeaders: headers,
    };
  }, [persons, relationships, flowMode, dimensions, isMobile]);

  // Seed animated particles proportionally to link volume
  useEffect(() => {
    const totalFlow = Math.max(
      1,
      links.reduce((acc, l) => acc + l.value, 0)
    );
    const maxParticles = isMobile ? 160 : 320;
    const particles: FlowParticle[] = [];

    links.forEach((l, idx) => {
      const count = Math.max(2, Math.round((l.value / totalFlow) * maxParticles));
      for (let i = 0; i < count; i++) {
        particles.push({
          linkIndex: idx,
          t: Math.random(),
          speed: 0.12 + Math.random() * 0.14,
          offset: (Math.random() - 0.5) * 0.78,
          size: 1.6 + Math.random() * 1.4,
        });
      }
    });

    particlesRef.current = particles;
  }, [links, isMobile]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const { width, height } = dimensions;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = isDark ? '#110f0d' : '#fcf9f4';
      ctx.fillRect(0, 0, width, height);

      // Column headers
      const colCount = Math.max(1, columnHeaders.length);
      const padLeft = isMobile ? 16 : 36;
      const padRight = isMobile ? 16 : 36;
      const nodeW = isMobile ? 14 : 18;
      const usableW = Math.max(200, width - padLeft - padRight - nodeW);

      ctx.font = '600 11.5px Inter, system-ui, sans-serif';
      ctx.fillStyle = isDark ? 'rgba(245, 239, 230, 0.65)' : 'rgba(68, 54, 39, 0.68)';
      ctx.textBaseline = 'middle';
      columnHeaders.forEach((header, idx) => {
        const x = colCount === 1 ? padLeft + usableW / 2 : padLeft + (idx / (colCount - 1)) * usableW;
        ctx.textAlign = idx === 0 ? 'left' : idx === colCount - 1 ? 'right' : 'center';
        const anchorX = idx === 0 ? x : idx === colCount - 1 ? x + nodeW : x + nodeW / 2;
        ctx.fillText(header.toUpperCase(), anchorX, 74);
      });

      const activeNodeId = hoveredNodeIdRef.current || selectedBucket?.id || null;
      const activeLinkId = hoveredLinkIdRef.current;

      // 1. Draw ribbons
      links.forEach((l) => {
        const isHighlighted =
          activeLinkId === l.id ||
          (activeNodeId && (l.sourceId === activeNodeId || l.targetId === activeNodeId));
        const isDimmed = Boolean((activeNodeId || activeLinkId) && !isHighlighted);

        const cpX = (l.sx + l.tx) / 2;
        const grad = ctx.createLinearGradient(l.sx, 0, l.tx, 0);
        const targetColor = nodeById.get(l.targetId)?.color || l.color;
        const alphaHex = isHighlighted ? (isDark ? '75' : '66') : isDimmed ? '14' : isDark ? '34' : '2c';
        grad.addColorStop(0, `${l.color}${alphaHex}`);
        grad.addColorStop(1, `${targetColor}${alphaHex}`);

        ctx.beginPath();
        ctx.moveTo(l.sx, l.sy0);
        ctx.bezierCurveTo(cpX, l.sy0, cpX, l.ty0, l.tx, l.ty0);
        ctx.lineTo(l.tx, l.ty1);
        ctx.bezierCurveTo(cpX, l.ty1, cpX, l.sy1, l.sx, l.sy1);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // 2. Update & draw luminous flowing particles
      const particles = particlesRef.current;
      for (const p of particles) {
        const l = links[p.linkIndex];
        if (!l) continue;

        if (isPlaying) {
          p.t += p.speed * dt;
          if (p.t > 1) p.t -= 1;
        }

        const isHighlighted =
          activeLinkId === l.id ||
          (activeNodeId && (l.sourceId === activeNodeId || l.targetId === activeNodeId));
        const isDimmed = Boolean((activeNodeId || activeLinkId) && !isHighlighted);
        if (isDimmed) continue;

        const cpX = (l.sx + l.tx) / 2;
        const sy = (l.sy0 + l.sy1) / 2 + p.offset * (l.sy1 - l.sy0);
        const ty = (l.ty0 + l.ty1) / 2 + p.offset * (l.ty1 - l.ty0);
        const pos = cubicBezierPoint(p.t, l.sx, sy, cpX, sy, cpX, ty, l.tx, ty);

        // Fade smoothly near ends
        const edgeFade = Math.sin(p.t * Math.PI);
        ctx.save();
        ctx.globalAlpha = Math.min(1, edgeFade * (isHighlighted ? 0.95 : 0.78));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isHighlighted ? p.size * 1.25 : p.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#fef3c7' : l.color;
        ctx.fill();
        ctx.restore();
      }

      // 3. Draw column nodes & labels
      nodes.forEach((n) => {
        const isHovered = hoveredNodeIdRef.current === n.id || selectedBucket?.id === n.id;
        ctx.save();

        ctx.beginPath();
        ctx.roundRect(n.x, n.y, n.w, n.h, 5);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (isHovered) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = isDark ? '#ffffff' : '#1e293b';
          ctx.stroke();
        }

        // Label next to bar
        const isLastCol = n.column === colCount - 1;
        ctx.font = isMobile
          ? '600 9.5px Inter, system-ui, sans-serif'
          : '600 11.5px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const labelX = isLastCol ? n.x - (isMobile ? 5 : 8) : n.x + n.w + (isMobile ? 5 : 8);
        ctx.textAlign = isLastCol ? 'right' : 'left';
        const shortLabel =
          isMobile && n.label.length > 9 ? `${n.label.slice(0, 8)}…` : n.label;
        const text = isMobile && colCount >= 4 ? `${n.count}` : `${shortLabel} (${n.count})`;

        // Subtle pill backing for legibility over ribbons
        const tw = ctx.measureText(text).width;
        const pillX = isLastCol ? labelX - tw - 5 : labelX - 4;
        const pillY = n.y + n.h / 2 - (isMobile ? 8 : 9);
        ctx.fillStyle = isDark ? 'rgba(17, 15, 13, 0.8)' : 'rgba(252, 249, 244, 0.88)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, tw + 9, isMobile ? 16 : 18, 6);
        ctx.fill();

        ctx.fillStyle = isDark ? '#f5efe6' : '#292118';
        ctx.fillText(text, labelX, n.y + n.h / 2 + 0.5);

        ctx.restore();
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, nodes, links, columnHeaders, isDark, isPlaying, isMobile, selectedBucket]);

  // Pointer interaction
  const findHit = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { node: null as SankeyNode | null, link: null as SankeyLink | null, x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      for (const n of nodes) {
        if (x >= n.x - 6 && x <= n.x + n.w + 6 && y >= n.y - 2 && y <= n.y + n.h + 2) {
          return { node: n, link: null, x, y };
        }
      }

      // Check ribbon midpoint band
      for (const l of links) {
        if (x >= l.sx && x <= l.tx) {
          const t = (x - l.sx) / Math.max(1, l.tx - l.sx);
          const cpX = (l.sx + l.tx) / 2;
          const topY = cubicBezierPoint(t, l.sx, l.sy0, cpX, l.sy0, cpX, l.ty0, l.tx, l.ty0).y;
          const botY = cubicBezierPoint(t, l.sx, l.sy1, cpX, l.sy1, cpX, l.ty1, l.tx, l.ty1).y;
          if (y >= topY - 2 && y <= botY + 2) {
            return { node: null, link: l, x, y };
          }
        }
      }
      return { node: null, link: null, x, y };
    },
    [nodes, links]
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { node, link, x, y } = findHit(e.clientX, e.clientY);
    hoveredNodeIdRef.current = node ? node.id : null;
    hoveredLinkIdRef.current = link ? link.id : null;

    if (node) {
      const pct = Math.round((node.count / Math.max(1, persons.length)) * 100);
      setHoverInfo({
        title: node.label,
        subtitle: `${node.count} anggota (${pct}%) • Klik untuk lihat daftar`,
        x,
        y,
      });
    } else if (link) {
      const s = nodes.find((n) => n.id === link.sourceId);
      const t = nodes.find((n) => n.id === link.targetId);
      setHoverInfo({
        title: `${s?.label || ''} → ${t?.label || ''}`,
        subtitle: `${link.value} anggota mengalir di jalur ini`,
        x,
        y,
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { node } = findHit(e.clientX, e.clientY);
    if (node) {
      setSelectedBucket((prev) => (prev?.id === node.id ? null : node));
    } else {
      setSelectedBucket(null);
    }
  };

  const modeButtons: { id: FlowMode; label: string; icon: typeof Layers }[] = [
    { id: 'gen_flow', label: 'Aliran Generasi', icon: Layers },
    { id: 'branch_status', label: 'Trah → Status', icon: GitBranch },
    { id: 'migration', label: 'Migrasi Kota', icon: MapPin },
  ];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] sm:min-h-[520px] overflow-hidden select-none rounded-lg border border-border/50"
    >
      {/* Top Controls (single-row horizontal scroll on mobile) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-10 flex items-center justify-between gap-1.5 pointer-events-none">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[calc(100%-46px)] sm:max-w-none bg-background/90 backdrop-blur-md p-1 rounded-xl border border-border/60 shadow-sm pointer-events-auto">
          {modeButtons.map((m) => {
            const Icon = m.icon;
            const active = flowMode === m.id;
            return (
              <Button
                key={m.id}
                size="sm"
                variant={active ? 'default' : 'ghost'}
                className="h-7 px-2 sm:px-2.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5 rounded-lg shrink-0"
                onClick={() => {
                  setFlowMode(m.id);
                  setSelectedBucket(null);
                }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{m.label}</span>
              </Button>
            );
          })}
        </div>

        <Button
          size={isMobile ? 'icon' : 'sm'}
          variant="outline"
          className="h-8 w-8 sm:w-auto sm:px-2.5 text-xs gap-1.5 shrink-0 bg-background/90 backdrop-blur-md pointer-events-auto"
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? 'Jeda Arus' : 'Jalankan Arus'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {!isMobile && <span>{isPlaying ? 'Jeda Arus' : 'Jalankan Arus'}</span>}
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          hoveredNodeIdRef.current = null;
          hoveredLinkIdRef.current = null;
          setHoverInfo(null);
        }}
        onClick={handleClick}
      />

      {/* Hover Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-2 rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-lg backdrop-blur-md text-xs max-w-[260px]"
          style={{
            left: Math.min(dimensions.width - 270, Math.max(12, hoverInfo.x + 14)),
            top: Math.min(dimensions.height - 84, Math.max(60, hoverInfo.y - 12)),
          }}
        >
          <div className="font-semibold text-sm leading-tight">{hoverInfo.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{hoverInfo.subtitle}</div>
        </div>
      )}

      {/* Selected Bucket Member Quick Drawer */}
      {selectedBucket && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:w-64 max-h-56 sm:max-h-60 overflow-y-auto rounded-xl bg-popover/95 text-popover-foreground border border-border shadow-xl backdrop-blur-md p-3 z-20">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedBucket.color }}
              />
              <span className="font-semibold text-xs truncate">{selectedBucket.label}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" className="text-[10px]">
                {selectedBucket.count}
              </Badge>
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                aria-label="Tutup daftar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {selectedBucket.members.slice(0, 25).map((m) => (
              <button
                key={m.id}
                type="button"
                className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors flex items-center justify-between gap-2"
                onClick={() => onSelectPerson?.(m.id)}
              >
                <span className="truncate">{m.fullName}</span>
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    m.gender === 'male'
                      ? 'bg-blue-500'
                      : m.gender === 'female'
                        ? 'bg-pink-500'
                        : 'bg-slate-400'
                  )}
                />
              </button>
            ))}
            {selectedBucket.members.length > 25 && (
              <div className="text-[10px] text-muted-foreground px-2 pt-1">
                +{selectedBucket.members.length - 25} anggota lainnya
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 bg-background/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/50 text-[11px] text-muted-foreground shadow-sm">
        <Users className="w-3.5 h-3.5" />
        <span>Klik balok kelompok untuk melihat anggota</span>
      </div>
    </div>
  );
}
