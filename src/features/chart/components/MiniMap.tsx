import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocateFixed, Map, Maximize2, Minimize2, X } from 'lucide-react';
import type { Person, Relationship } from '@/types';
import { cn } from '@/lib/utils';

interface MiniMapProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onCenterSelected?: () => void;
  className?: string;
}

interface TreeNode {
  person: Person;
  generation: number;
  x: number;
  y: number;
}

export function MiniMap({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onCenterSelected,
  className,
}: MiniMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Calculate generation for each person
  const getGeneration = useCallback((personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    
    const parentRels = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === personId
    );
    
    if (parentRels.length === 0) return 1;
    return Math.max(...parentRels.map(r => getGeneration(r.fromPersonId, new Set(visited)))) + 1;
  }, [relationships]);

  // Build tree structure for mini map
  const treeNodes = useMemo(() => {
    if (persons.length === 0) return [];

    // Group by generation
    const byGeneration: Record<number, Person[]> = {};
    persons.forEach(p => {
      const gen = getGeneration(p.id);
      if (!byGeneration[gen]) byGeneration[gen] = [];
      byGeneration[gen].push(p);
    });

    const generations = Object.keys(byGeneration)
      .map(Number)
      .sort((a, b) => a - b);

    const nodes: TreeNode[] = [];
    const maxPerGen = Math.max(...generations.map(g => byGeneration[g]?.length || 0));
    
    generations.forEach((gen, genIndex) => {
      const people = byGeneration[gen] || [];
      const spacing = 100 / (people.length + 1);
      
      people.forEach((person, idx) => {
        nodes.push({
          person,
          generation: gen,
          x: spacing * (idx + 1),
          y: ((genIndex + 1) / (generations.length + 1)) * 100,
        });
      });
    });

    return nodes;
  }, [persons, getGeneration]);

  // Get edges for tree connections
  const edges = useMemo(() => {
    const nodeMap: Record<string, TreeNode> = {};
    treeNodes.forEach(n => { nodeMap[n.person.id] = n; });
    const lines: { from: TreeNode; to: TreeNode; type: 'parent' | 'spouse' }[] = [];

    relationships.forEach(rel => {
      const fromNode = nodeMap[rel.fromPersonId];
      const toNode = nodeMap[rel.toPersonId];
      if (fromNode && toNode) {
        if (rel.type === 'PARENT_CHILD') {
          lines.push({ from: fromNode, to: toNode, type: 'parent' });
        } else if (rel.type === 'SPOUSE') {
          lines.push({ from: fromNode, to: toNode, type: 'spouse' });
        }
      }
    });

    return lines;
  }, [treeNodes, relationships]);

  if (persons.length === 0) return null;

  const mapWidth = isExpanded ? 320 : 180;
  const mapHeight = isExpanded ? 240 : 140;
  const canCenter = Boolean(selectedPersonId && onCenterSelected);

  return (
    <AnimatePresence>
      {!isMinimized ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={cn(
            "fixed bottom-4 right-4 z-50 bg-card/95 backdrop-blur-sm border rounded-xl shadow-xl overflow-hidden",
            className
          )}
          style={{ width: mapWidth, height: mapHeight + 36 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Map className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Mini Map</span>
              <span className="text-[10px] text-muted-foreground">
                ({persons.length} orang)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onCenterSelected}
                className={cn(
                  "p-1 rounded transition-colors",
                  canCenter ? "hover:bg-muted" : "opacity-40 cursor-not-allowed"
                )}
                title="Pusatkan ke pilihan"
                disabled={!canCenter}
              >
                <LocateFixed className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-muted rounded transition-colors"
                title={isExpanded ? "Perkecil" : "Perbesar"}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-muted rounded transition-colors"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Map Content */}
          <div 
            className="relative bg-background/50"
            style={{ width: mapWidth, height: mapHeight }}
          >
            <svg width="100%" height="100%" className="absolute inset-0">
              {/* Connection lines */}
              {edges.map((edge, i) => (
                <line
                  key={i}
                  x1={`${edge.from.x}%`}
                  y1={`${edge.from.y}%`}
                  x2={`${edge.to.x}%`}
                  y2={`${edge.to.y}%`}
                  stroke={edge.type === 'spouse' ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                  strokeWidth={edge.type === 'spouse' ? 1.5 : 1}
                  strokeDasharray={edge.type === 'spouse' ? '2 2' : undefined}
                  opacity={0.6}
                />
              ))}
            </svg>

            {/* Person nodes */}
            {treeNodes.map((node) => {
              const isSelected = node.person.id === selectedPersonId;
              const nodeSize = isExpanded ? 10 : 6;
              
              return (
                <motion.button
                  key={node.person.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.5 }}
                  onClick={() => onSelectPerson(node.person.id)}
                  className={cn(
                    "absolute rounded-full transition-all cursor-pointer",
                    "hover:ring-2 hover:ring-primary/50",
                    isSelected && "ring-2 ring-primary shadow-lg",
                    node.person.gender === 'male' 
                      ? 'bg-node-male' 
                      : node.person.gender === 'female' 
                        ? 'bg-node-female' 
                        : 'bg-node-unknown'
                  )}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    width: isSelected ? nodeSize + 4 : nodeSize,
                    height: isSelected ? nodeSize + 4 : nodeSize,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={node.person.fullName}
                />
              );
            })}

            {/* Selected person indicator */}
            {selectedPersonId && (
              <div className="absolute bottom-1 left-1 right-1">
                <div className="bg-card/90 backdrop-blur-sm rounded px-2 py-1 border shadow-sm">
                  <p className="text-[10px] font-medium truncate text-center">
                    {persons.find(p => p.id === selectedPersonId)?.fullName || '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => setIsMinimized(false)}
          className={cn(
            "fixed bottom-4 right-4 z-50 p-3 bg-card/95 backdrop-blur-sm",
            "border rounded-full shadow-lg hover:shadow-xl transition-all",
            "hover:bg-muted/50"
          )}
          title="Buka Mini Map"
        >
          <Map className="w-5 h-5 text-muted-foreground" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
