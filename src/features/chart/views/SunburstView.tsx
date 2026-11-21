import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useTheme } from 'next-themes';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowUpLeft,
  ChevronRight,
  GitFork,
  Users,
  Palette,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Person, Relationship } from '@/types';

interface SunburstViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}

type SunburstMode = 'descendants' | 'ancestors';
type ColorMode = 'gender' | 'branch';

interface HierarchyNode {
  name: string;
  id: string;
  gender: Person['gender'];
  birthDate?: string | null;
  deathDate?: string | null;
  branchIndex?: number;
  children?: HierarchyNode[];
  value?: number;
}

interface HoveredInfo {
  id: string;
  name: string;
  gender: Person['gender'];
  birthDate?: string | null;
  deathDate?: string | null;
  depth: number;
  subCount: number;
  hasChildren: boolean;
  lineage: string[];
  x: number;
  y: number;
}

const BRANCH_PALETTE = [
  { h: 28, s: 72 },  // Warm amber-brown
  { h: 174, s: 62 }, // Deep teal
  { h: 215, s: 68 }, // Heritage blue
  { h: 338, s: 64 }, // Berry rose
  { h: 92, s: 46 },  // Olive sage
  { h: 268, s: 52 }, // Plum
  { h: 14, s: 70 },  // Terracotta
  { h: 196, s: 65 }, // Ocean
];

function extractYear(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatLifeSpan(birthDate?: string | null, deathDate?: string | null): string | null {
  const b = extractYear(birthDate);
  const d = extractYear(deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return `l. ${b}`;
  if (d) return `w. ${d}`;
  return null;
}

function formatShortName(fullName: string, maxChars: number): string {
  if (maxChars < 3) return '';
  if (fullName.length <= maxChars) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) {
    // Try "First L."
    const firstWithInitial = `${parts[0]} ${parts[parts.length - 1][0]}.`;
    if (firstWithInitial.length <= maxChars) return firstWithInitial;
    // Try first name only
    if (parts[0].length <= maxChars) return parts[0];
  }

  const cutLen = Math.max(2, maxChars - 1);
  return `${fullName.slice(0, cutLen)}…`;
}

function wrapCenterText(name: string, maxCharsPerLine: number): string[] {
  if (name.length <= maxCharsPerLine) return [name];
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return [name.slice(0, Math.max(4, maxCharsPerLine - 1)) + '…'];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === 1) break;
    }
  }
  if (current && lines.length < 2) {
    lines.push(
      current.length > maxCharsPerLine
        ? `${current.slice(0, Math.max(4, maxCharsPerLine - 1))}…`
        : current
    );
  }
  return lines;
}

export function SunburstView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
}: SunburstViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [mode, setMode] = useState<SunburstMode>('descendants');
  const [colorMode, setColorMode] = useState<ColorMode>('gender');
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [hoveredInfo, setHoveredInfo] = useState<HoveredInfo | null>(null);
  const [rootHistory, setRootHistory] = useState<string[]>([]);

  // Lookup maps for fast graph traversal
  const graphMaps = useMemo(() => {
    const personById = new Map(persons.map((p) => [p.id, p]));
    const childrenByParent = new Map<string, string[]>();
    const parentsByChild = new Map<string, string[]>();

    for (const rel of relationships) {
      if (rel.type !== 'PARENT_CHILD') continue;
      if (!childrenByParent.has(rel.fromPersonId)) {
        childrenByParent.set(rel.fromPersonId, []);
      }
      childrenByParent.get(rel.fromPersonId)!.push(rel.toPersonId);

      if (!parentsByChild.has(rel.toPersonId)) {
        parentsByChild.set(rel.toPersonId, []);
      }
      parentsByChild.get(rel.toPersonId)!.push(rel.fromPersonId);
    }

    return { personById, childrenByParent, parentsByChild };
  }, [persons, relationships]);

  // Compute best default root (oldest/top ancestor with most descendants)
  const bestDefaultRootId = useMemo(() => {
    if (persons.length === 0) return null;

    const countDescendants = (startId: string): number => {
      const visited = new Set<string>([startId]);
      const queue = [startId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const kids = graphMaps.childrenByParent.get(curr) ?? [];
        for (const kid of kids) {
          if (!visited.has(kid)) {
            visited.add(kid);
            queue.push(kid);
          }
        }
      }
      return visited.size - 1;
    };

    // Prefer root ancestors (no parents) with maximum descendants
    const topAncestors = persons.filter(
      (p) => (graphMaps.parentsByChild.get(p.id)?.length ?? 0) === 0
    );
    const candidates = topAncestors.length > 0 ? topAncestors : persons;

    let bestId = candidates[0].id;
    let bestScore = -1;
    for (const person of candidates) {
      const score = countDescendants(person.id);
      if (score > bestScore) {
        bestScore = score;
        bestId = person.id;
      }
    }
    return bestId;
  }, [persons, graphMaps]);

  const [rootPersonId, setRootPersonId] = useState<string | null>(
    selectedPersonId || bestDefaultRootId
  );

  // Ensure rootPersonId is valid and sync when selectedPersonId is outside current tree (e.g., from Search)
  useEffect(() => {
    if (rootPersonId && graphMaps.personById.has(rootPersonId)) return;
    if (selectedPersonId && graphMaps.personById.has(selectedPersonId)) {
      setRootPersonId(selectedPersonId);
    } else if (bestDefaultRootId) {
      setRootPersonId(bestDefaultRootId);
    }
  }, [rootPersonId, selectedPersonId, bestDefaultRootId, graphMaps.personById]);

  // If user selects someone via global search who isn't in the current sunburst subtree, recenter on them
  useEffect(() => {
    if (!selectedPersonId || !graphMaps.personById.has(selectedPersonId)) return;
    if (!hierarchyData) {
      setRootPersonId(selectedPersonId);
      return;
    }
    const containsId = (node: HierarchyNode, targetId: string): boolean => {
      if (node.id === targetId) return true;
      return Boolean(node.children?.some((c) => containsId(c, targetId)));
    };
    if (!containsId(hierarchyData, selectedPersonId)) {
      setRootPersonId(selectedPersonId);
      setRootHistory([]);
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [selectedPersonId, graphMaps.personById]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [persons]
  );

  // Measure available chart stage dynamically
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setStageSize({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build hierarchy tree
  const hierarchyData = useMemo(() => {
    if (!rootPersonId) return null;

    const adjacency =
      mode === 'descendants' ? graphMaps.childrenByParent : graphMaps.parentsByChild;

    const buildTree = (
      personId: string,
      depth: number,
      visited: Set<string>,
      branchIndex?: number
    ): HierarchyNode | null => {
      if (depth > 8) return null;
      if (visited.has(personId)) return null;
      const person = graphMaps.personById.get(personId);
      if (!person) return null;

      const nextVisited = new Set(visited);
      nextVisited.add(personId);

      const nextIds = adjacency.get(personId) ?? [];
      const children = nextIds
        .map((cid, idx) =>
          buildTree(cid, depth + 1, nextVisited, depth === 0 ? idx : branchIndex)
        )
        .filter((n): n is HierarchyNode => n !== null);

      return {
        name: person.fullName,
        id: person.id,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        branchIndex,
        children: children.length > 0 ? children : undefined,
        value: children.length === 0 ? 1 : undefined,
      };
    };

    return buildTree(rootPersonId, 0, new Set());
  }, [rootPersonId, mode, graphMaps]);

  const handleChangeRoot = useCallback((newRootId: string, pushHistory = false) => {
    setRootPersonId((prev) => {
      if (pushHistory && prev && prev !== newRootId) {
        setRootHistory((hist) => [...hist, prev]);
      } else if (!pushHistory) {
        setRootHistory([]);
      }
      return newRootId;
    });
    setHoveredInfo(null);
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleNavigateUp = useCallback(() => {
    setRootHistory((hist) => {
      if (hist.length === 0) return hist;
      const prevRoot = hist[hist.length - 1];
      setRootPersonId(prevRoot);
      setHoveredInfo(null);
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
      return hist.slice(0, -1);
    });
  }, []);

  const handleResetView = useCallback(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomScale((s) => Math.min(2.4, Number((s + 0.25).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((s) => Math.max(0.65, Number((s - 0.25).toFixed(2))));
  }, []);

  // Mouse wheel zoom on stage
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    setZoomScale((s) => Math.max(0.65, Math.min(2.4, Number((s + delta).toFixed(2)))));
  }, []);

  // Drag to pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // Only start pan if dragging background or while zoomed
      if ((e.target as HTMLElement).closest('button')) return;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // Arc fill color helper
  const getNodeColor = useCallback(
    (node: d3.HierarchyRectangularNode<HierarchyNode>, maxDepth: number) => {
      const depthRatio = maxDepth > 1 ? (node.depth - 1) / (maxDepth - 1) : 0;

      if (colorMode === 'branch') {
        const bIdx = (node.data.branchIndex ?? 0) % BRANCH_PALETTE.length;
        const { h, s } = BRANCH_PALETTE[bIdx];
        const l = isDark
          ? Math.round(42 + depthRatio * 18)
          : Math.round(42 + depthRatio * 20);
        const sat = Math.round(s - depthRatio * 10);
        return `hsl(${h}, ${sat}%, ${l}%)`;
      }

      // Gender mode using warm heritage-tuned tones
      if (node.data.gender === 'male') {
        const l = isDark
          ? Math.round(44 + depthRatio * 16)
          : Math.round(43 + depthRatio * 19);
        return `hsl(204, 62%, ${l}%)`;
      }
      if (node.data.gender === 'female') {
        const l = isDark
          ? Math.round(48 + depthRatio * 16)
          : Math.round(50 + depthRatio * 17);
        return `hsl(340, 62%, ${l}%)`;
      }
      const l = isDark ? Math.round(42 + depthRatio * 14) : Math.round(48 + depthRatio * 16);
      return `hsl(30, 18%, ${l}%)`;
    },
    [colorMode, isDark]
  );

  const hasBranches = (hierarchyData?.children?.length ?? 0) > 0;

  // Render D3 Sunburst
  useEffect(() => {
    if (!hierarchyData || !svgRef.current || stageSize.width === 0 || stageSize.height === 0) {
      return;
    }

    const width = stageSize.width;
    const height = stageSize.height;
    const padding = Math.min(width, height) < 420 ? 14 : 26;
    const outerRadius = Math.max(90, Math.min(width, height) / 2 - padding);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);

    // Subtle drop shadow filter for center medallion
    const defs = svg.append('defs');
    const filter = defs
      .append('filter')
      .attr('id', 'sunburst-center-shadow')
      .attr('x', '-25%')
      .attr('y', '-25%')
      .attr('width', '150%')
      .attr('height', '150%');
    filter
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 3)
      .attr('stdDeviation', 6)
      .attr('flood-color', isDark ? '#000000' : '#4a3520')
      .attr('flood-opacity', isDark ? 0.45 : 0.14);

    const g = svg.append('g');

    // Build D3 hierarchy
    const root = d3
      .hierarchy<HierarchyNode>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const maxDepth = Math.max(1, root.height);
    const totalSubNodes = root.descendants().length - 1;

    // Partition angles [0, 2*PI]
    d3.partition<HierarchyNode>().size([2 * Math.PI, outerRadius])(root);
    const rootNode = root as unknown as d3.HierarchyRectangularNode<HierarchyNode>;

    // Custom proportional radial mapping so center circle & every generation ring look balanced
    const innerHoleRadius = Math.max(52, Math.min(outerRadius * 0.27, 94));
    const availableRingSpace = Math.max(36, outerRadius - innerHoleRadius);
    const ringThickness = Math.min(availableRingSpace / maxDepth, outerRadius * 0.42);
    const ringGap = Math.max(2, Math.min(3.5, ringThickness * 0.05));

    const getInnerR = (depth: number) => {
      if (depth === 0) return 0;
      return innerHoleRadius + (depth - 1) * ringThickness + ringGap;
    };
    const getOuterR = (depth: number) => {
      if (depth === 0) return innerHoleRadius;
      return innerHoleRadius + depth * ringThickness;
    };

    const arc = d3
      .arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.01))
      .padRadius(outerRadius * 0.55)
      .innerRadius((d) => getInnerR(d.depth))
      .outerRadius((d) => Math.max(getInnerR(d.depth) + 2, getOuterR(d.depth)))
      .cornerRadius(4);

    const descendants = rootNode.descendants().filter((d) => d.depth > 0);

    // Subtle concentric guide rings behind arcs
    if (descendants.length > 0) {
      const guideGroup = g.append('g').attr('pointer-events', 'none');
      for (let d = 1; d <= maxDepth; d++) {
        guideGroup
          .append('circle')
          .attr('r', getOuterR(d))
          .attr('fill', 'none')
          .attr('stroke', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(120,85,50,0.08)')
          .attr('stroke-dasharray', '3 4');
      }
    }

    // Draw arc segments
    const arcGroup = g.append('g');
    const paths = arcGroup
      .selectAll('path')
      .data(descendants)
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => getNodeColor(d, maxDepth))
      .attr('fill-opacity', 0.92)
      .attr('stroke', (d) =>
        d.data.id === selectedPersonId
          ? 'hsl(38, 92%, 52%)'
          : isDark
            ? 'hsl(25, 25%, 10%)'
            : 'hsl(40, 33%, 98%)'
      )
      .attr('stroke-width', (d) => (d.data.id === selectedPersonId ? 3 : 1.5))
      .style('cursor', 'pointer')
      .style('transition', 'fill-opacity 150ms ease, filter 150ms ease');

    // Interactive hover, click, double-click
    paths
      .on('mouseenter', function (event, d) {
        const ancestorSet = new Set(d.ancestors().map((a) => a.data.id));
        paths.attr('fill-opacity', (node) => (ancestorSet.has(node.data.id) ? 1 : 0.32));
        d3.select(this).style('filter', 'brightness(1.08)');

        const stageRect = stageRef.current?.getBoundingClientRect();
        const x = stageRect ? event.clientX - stageRect.left : 0;
        const y = stageRect ? event.clientY - stageRect.top : 0;

        setHoveredInfo({
          id: d.data.id,
          name: d.data.name,
          gender: d.data.gender,
          birthDate: d.data.birthDate,
          deathDate: d.data.deathDate,
          depth: d.depth,
          subCount: d.descendants().length - 1,
          hasChildren: Boolean(d.children && d.children.length > 0),
          lineage: d
            .ancestors()
            .map((a) => a.data.name)
            .reverse(),
          x,
          y,
        });
      })
      .on('mousemove', function (event) {
        const stageRect = stageRef.current?.getBoundingClientRect();
        if (!stageRect) return;
        const x = event.clientX - stageRect.left;
        const y = event.clientY - stageRect.top;
        setHoveredInfo((prev) => (prev ? { ...prev, x, y } : null));
      })
      .on('mouseleave', function () {
        paths.attr('fill-opacity', 0.92).style('filter', null);
        setHoveredInfo(null);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectPerson(d.data.id);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (d.children && d.children.length > 0) {
          handleChangeRoot(d.data.id, true);
        }
      });

    // --- SMART ARC LABELS ---
    const labelGroup = g
      .append('g')
      .attr('pointer-events', 'none')
      .style('user-select', 'none');

    const baseFontSize = Math.max(9.5, Math.min(12.5, outerRadius / 24));

    labelGroup
      .selectAll('text')
      .data(descendants)
      .join('text')
      .each(function (d) {
        const innerR = getInnerR(d.depth);
        const outerR = getOuterR(d.depth);
        const midR = (innerR + outerR) / 2;
        const thick = outerR - innerR;
        const angleSpan = d.x1 - d.x0;
        const midAngle = (d.x0 + d.x1) / 2;
        const arcLen = angleSpan * midR;

        // Decide whether tangential or radial fits better
        const useTangential = arcLen >= thick * 1.1 && arcLen >= 34 && thick >= 22;
        const useRadial = !useTangential && arcLen >= 16 && thick >= 32;

        if (!useTangential && !useRadial) {
          d3.select(this).remove();
          return;
        }

        const fontSize = Math.min(
          baseFontSize,
          useTangential ? thick * 0.42 : arcLen * 0.52
        );
        if (fontSize < 8.5) {
          d3.select(this).remove();
          return;
        }

        const availWidth = (useTangential ? arcLen : thick) * 0.84;
        const avgCharWidth = fontSize * 0.58;
        const maxChars = Math.floor(availWidth / avgCharWidth);
        const label = formatShortName(d.data.name, maxChars);

        if (!label) {
          d3.select(this).remove();
          return;
        }

        const angleDeg = (midAngle * 180) / Math.PI - 90;
        let transform: string;

        if (useTangential) {
          // Tangential text along the arc
          const onBottomHalf = midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2;
          const rot = onBottomHalf ? angleDeg - 90 : angleDeg + 90;
          const x = Math.cos(midAngle - Math.PI / 2) * midR;
          const y = Math.sin(midAngle - Math.PI / 2) * midR;
          transform = `translate(${x},${y}) rotate(${rot})`;
        } else {
          // Radial text pointing outward, flipped on left half
          const flip = angleDeg > 90 && angleDeg < 270;
          transform = `rotate(${angleDeg}) translate(${midR},0) rotate(${flip ? 180 : 0})`;
        }

        d3.select(this)
          .attr('transform', transform)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .style('fill', '#ffffff')
          .style('font-size', `${fontSize.toFixed(1)}px`)
          .style('font-weight', '600')
          .style('text-shadow', '0 1px 2px rgba(0,0,0,0.35)')
          .text(label);
      });

    // --- CENTER MEDALLION ---
    const centerGroup = g
      .append('g')
      .style('cursor', 'pointer')
      .on('click', (event) => {
        event.stopPropagation();
        if (rootHistory.length > 0) {
          handleNavigateUp();
        } else {
          onSelectPerson(hierarchyData.id);
        }
      });

    const centerFill = isDark ? 'hsl(25, 22%, 14%)' : 'hsl(40, 40%, 99%)';
    const centerStroke =
      hierarchyData.id === selectedPersonId
        ? 'hsl(38, 92%, 52%)'
        : hierarchyData.gender === 'male'
          ? 'hsl(204, 62%, 52%)'
          : hierarchyData.gender === 'female'
            ? 'hsl(340, 62%, 58%)'
            : isDark
              ? 'hsl(30, 18%, 35%)'
              : 'hsl(30, 25%, 78%)';

    centerGroup
      .append('circle')
      .attr('r', innerHoleRadius - 2)
      .attr('fill', centerFill)
      .attr('stroke', centerStroke)
      .attr('stroke-width', hierarchyData.id === selectedPersonId ? 3 : 2)
      .attr('filter', 'url(#sunburst-center-shadow)');

    // Center name (wrapped up to 2 lines)
    const centerFontSize = Math.max(11, Math.min(15, innerHoleRadius * 0.22));
    const maxCenterChars = Math.max(8, Math.floor((innerHoleRadius * 1.6) / (centerFontSize * 0.56)));
    const centerLines = wrapCenterText(hierarchyData.name, maxCenterChars);
    const hasUpHint = rootHistory.length > 0;
    const baseOffsetY = centerLines.length === 2 ? -10 : -4;

    centerLines.forEach((line, idx) => {
      centerGroup
        .append('text')
        .attr('y', baseOffsetY + idx * (centerFontSize + 2) - (hasUpHint ? 4 : 0))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-family', 'var(--font-display), serif')
        .style('font-size', `${centerFontSize}px`)
        .style('font-weight', '700')
        .style('fill', isDark ? 'hsl(40, 30%, 94%)' : 'hsl(25, 25%, 16%)')
        .style('pointer-events', 'none')
        .text(line);
    });

    // Center subtitle stats
    const subY =
      baseOffsetY +
      centerLines.length * (centerFontSize + 2) +
      (centerLines.length === 1 ? 6 : 2) -
      (hasUpHint ? 4 : 0);

    centerGroup
      .append('text')
      .attr('y', subY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${Math.max(9.5, centerFontSize * 0.72)}px`)
      .style('font-weight', '500')
      .style('fill', isDark ? 'hsl(30, 15%, 65%)' : 'hsl(25, 15%, 45%)')
      .style('pointer-events', 'none')
      .text(
        totalSubNodes > 0
          ? `${totalSubNodes} ${mode === 'descendants' ? 'keturunan' : 'leluhur'} · ${maxDepth} gen`
          : mode === 'descendants'
            ? 'Belum ada keturunan'
            : 'Belum ada leluhur'
      );

    if (hasUpHint) {
      centerGroup
        .append('text')
        .attr('y', subY + 15)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '9.5px')
        .style('font-weight', '600')
        .style('fill', isDark ? 'hsl(38, 80%, 60%)' : 'hsl(25, 65%, 38%)')
        .style('pointer-events', 'none')
        .text('↑ Klik untuk naik');
    }
  }, [
    hierarchyData,
    stageSize,
    isDark,
    selectedPersonId,
    mode,
    colorMode,
    rootHistory.length,
    getNodeColor,
    onSelectPerson,
    handleChangeRoot,
    handleNavigateUp,
  ]);

  // Clamp tooltip inside stage
  const tooltipPosition = useMemo(() => {
    if (!hoveredInfo) return null;
    const cardW = 240;
    const cardH = 110;
    const offset = 16;
    let left = hoveredInfo.x + offset;
    let top = hoveredInfo.y - cardH / 2;

    if (left + cardW > stageSize.width - 12) {
      left = Math.max(12, hoveredInfo.x - cardW - offset);
    }
    if (top < 12) top = 12;
    if (top + cardH > stageSize.height - 12) {
      top = Math.max(12, stageSize.height - cardH - 12);
    }
    return { left, top };
  }, [hoveredInfo, stageSize]);

  const prevRootName =
    rootHistory.length > 0
      ? graphMaps.personById.get(rootHistory[rootHistory.length - 1])?.fullName
      : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Compact Top Control Bar */}
      <div
        data-export-ignore="true"
        className="shrink-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-background/75 px-3 py-2 backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Pusat:
            </span>
            <Select
              value={rootPersonId || undefined}
              onValueChange={(val) => handleChangeRoot(val, false)}
            >
              <SelectTrigger className="h-8 w-[180px] sm:w-[220px] rounded-lg bg-background/90 text-xs">
                <SelectValue placeholder="Pilih anggota..." />
              </SelectTrigger>
              <SelectContent>
                {sortedPersons.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rootHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 rounded-lg px-2.5 text-xs"
              onClick={handleNavigateUp}
              title={`Kembali ke ${prevRootName ?? 'sebelumnya'}`}
            >
              <ArrowUpLeft className="h-3.5 w-3.5" />
              <span className="max-w-[120px] truncate">
                {prevRootName || 'Naik level'}
              </span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Mode toggle: Descendants vs Ancestors */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('descendants');
                setHoveredInfo(null);
              }}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                mode === 'descendants'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <GitFork className="h-3 w-3" />
              Keturunan
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('ancestors');
                setHoveredInfo(null);
              }}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                mode === 'ancestors'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Users className="h-3 w-3" />
              Leluhur
            </button>
          </div>

          {/* Color mode toggle */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setColorMode('gender')}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                colorMode === 'gender'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Warna berdasarkan gender"
            >
              Gender
            </button>
            <button
              type="button"
              onClick={() => setColorMode('branch')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                colorMode === 'branch'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Warna berdasarkan cabang keluarga"
            >
              <Palette className="h-3 w-3" />
              Cabang
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center rounded-lg border border-border/70 bg-background/80">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-r-none"
              onClick={handleZoomOut}
              title="Perkecil"
              aria-label="Perkecil sunburst"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-none border-x px-2 text-[11px] font-medium tabular-nums"
              onClick={handleResetView}
              title="Sesuaikan layar (Fit)"
            >
              {zoomScale === 1 && pan.x === 0 && pan.y === 0 ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                `${Math.round(zoomScale * 100)}%`
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={handleZoomIn}
              title="Perbesar"
              aria-label="Perbesar sunburst"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Responsive Stage */}
      <div
        ref={stageRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          'flex-1 min-h-0 w-full relative overflow-hidden select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 160ms ease-out',
          }}
        >
          <svg ref={svgRef} data-export-svg="true" className="w-full h-full block" />
        </div>

        {/* Floating Rich Hover Tooltip */}
        {hoveredInfo && tooltipPosition && (
          <div
            className="pointer-events-none absolute z-30 w-[235px] rounded-xl border border-border/80 bg-popover/95 p-3 shadow-lg backdrop-blur-md"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-sm font-semibold leading-snug text-popover-foreground">
                {hoveredInfo.name}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  hoveredInfo.gender === 'male'
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                    : hoveredInfo.gender === 'female'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                Gen {hoveredInfo.depth}
              </span>
            </div>

            {formatLifeSpan(hoveredInfo.birthDate, hoveredInfo.deathDate) && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatLifeSpan(hoveredInfo.birthDate, hoveredInfo.deathDate)}
              </p>
            )}

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {hoveredInfo.subCount > 0
                  ? `${hoveredInfo.subCount} ${mode === 'descendants' ? 'keturunan' : 'leluhur'}`
                  : mode === 'descendants'
                    ? 'Generasi terakhir'
                    : 'Leluhur teratas'}
              </span>
              {hoveredInfo.hasChildren && (
                <span className="text-[10px] font-medium text-primary">
                  Klik 2× fokus
                </span>
              )}
            </div>
          </div>
        )}

        {/* Helpful empty-branch banner when chosen root has no descendants/ancestors */}
        {hierarchyData && !hasBranches && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/90 px-4 py-2.5 text-xs text-muted-foreground shadow-md backdrop-blur-md">
            <span>
              <strong>{hierarchyData.name}</strong> belum memiliki data{' '}
              {mode === 'descendants' ? 'keturunan' : 'leluhur'}.
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setMode(mode === 'descendants' ? 'ancestors' : 'descendants')}
            >
              Lihat {mode === 'descendants' ? 'Leluhur' : 'Keturunan'}
            </Button>
            {bestDefaultRootId && bestDefaultRootId !== rootPersonId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleChangeRoot(bestDefaultRootId, false)}
              >
                Ke Leluhur Utama
              </Button>
            )}
          </div>
        )}

        {/* Bottom Lineage Breadcrumb / Hint + Legend */}
        <div
          data-export-ignore="true"
          className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-end justify-between gap-2"
        >
          <div className="max-w-full sm:max-w-[70%] rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
            {hoveredInfo ? (
              <div className="flex flex-wrap items-center gap-1">
                {hoveredInfo.lineage.map((name, idx) => (
                  <span key={`${name}-${idx}`} className="inline-flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                    <span
                      className={
                        idx === hoveredInfo.lineage.length - 1
                          ? 'font-semibold text-foreground'
                          : ''
                      }
                    >
                      {name}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span>
                Klik segmen untuk detail · Klik ganda untuk fokus cabang · Scroll untuk zoom
              </span>
            )}
          </div>

          {colorMode === 'gender' && (
            <div className="hidden sm:flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(204,62%,48%)]" />
                Laki-laki
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(340,62%,54%)]" />
                Perempuan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-2 ring-amber-500 bg-transparent" />
                Terpilih
              </span>
            </div>
          )}
        </div>

        {/* Empty state when no persons at all */}
        {!rootPersonId && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="rounded-xl border border-border/60 bg-background/90 px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Pilih seseorang untuk melihat diagram sunburst
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
