import { cn } from '@/lib/utils';

interface ConnectorLineProps {
  className?: string;
}

// Vertical line connector
export function VerticalConnector({ className }: ConnectorLineProps) {
  return (
    <svg className={cn("w-2 h-8", className)} viewBox="0 0 8 32" fill="none">
      <path
        d="M4 0 L4 32"
        stroke="currentColor"
        strokeWidth="2"
        className="text-border"
      />
    </svg>
  );
}

// Horizontal line connector
export function HorizontalConnector({ className }: ConnectorLineProps) {
  return (
    <svg className={cn("w-8 h-2", className)} viewBox="0 0 32 8" fill="none">
      <path
        d="M0 4 L32 4"
        stroke="currentColor"
        strokeWidth="2"
        className="text-border"
      />
    </svg>
  );
}

interface CurvedConnectorProps {
  direction: 'down-left' | 'down-right' | 'up-left' | 'up-right' | 'left-down' | 'right-down';
  className?: string;
}

// Curved corner connector
export function CurvedConnector({ direction, className }: CurvedConnectorProps) {
  const paths = {
    'down-left': 'M16 0 Q16 16, 0 16',
    'down-right': 'M16 0 Q16 16, 32 16',
    'up-left': 'M16 32 Q16 16, 0 16',
    'up-right': 'M16 32 Q16 16, 32 16',
    'left-down': 'M0 8 Q16 8, 16 24',
    'right-down': 'M32 8 Q16 8, 16 24',
  };

  return (
    <svg className={cn("w-8 h-8", className)} viewBox="0 0 32 32" fill="none">
      <path
        d={paths[direction]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-border"
        fill="none"
      />
    </svg>
  );
}

interface FamilyConnectorProps {
  hasParents?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  className?: string;
}

// Main family connector - connects parents to children
export function FamilyConnector({ hasParents, hasChildren, childCount = 0, className }: FamilyConnectorProps) {
  const width = Math.max(200, childCount * 100);
  const height = 48;
  const midY = height / 2;
  
  return (
    <svg 
      className={cn("w-full", className)} 
      viewBox={`0 0 ${width} ${height}`} 
      style={{ height: `${height}px`, width: `${width}px` }}
      fill="none"
    >
      {/* Vertical line from parents */}
      {hasParents && (
        <path
          d={`M${width/2} 0 L${width/2} ${midY}`}
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
      )}
      
      {/* Horizontal line for children */}
      {hasChildren && childCount > 1 && (
        <path
          d={`M${width * 0.2} ${midY} L${width * 0.8} ${midY}`}
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
      )}
      
      {/* Vertical lines to each child */}
      {hasChildren && Array.from({ length: childCount }).map((_, i) => {
        const x = childCount === 1 
          ? width / 2 
          : (width * 0.2) + (i * (width * 0.6) / (childCount - 1));
        return (
          <path
            key={i}
            d={`M${x} ${midY} L${x} ${height}`}
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
          />
        );
      })}
    </svg>
  );
}

interface PedigreeConnectorProps {
  hasFather?: boolean;
  hasMother?: boolean;
  height?: number;
  className?: string;
}

// Pedigree tree connector - horizontal branching
export function PedigreeConnector({ hasFather, hasMother, height = 120, className }: PedigreeConnectorProps) {
  const width = 32;
  const midY = height / 2;
  const branchGap = height * 0.35;
  
  return (
    <svg 
      className={cn("shrink-0", className)} 
      viewBox={`0 0 ${width} ${height}`} 
      style={{ height: `${height}px`, width: `${width}px` }}
      fill="none"
    >
      {/* Main horizontal line from person */}
      <path
        d={`M0 ${midY} L${width * 0.4} ${midY}`}
        stroke="currentColor"
        strokeWidth="2"
        className="text-border"
      />
      
      {/* Vertical bracket */}
      {(hasFather || hasMother) && (
        <path
          d={`M${width * 0.4} ${midY - branchGap} L${width * 0.4} ${midY + branchGap}`}
          stroke="currentColor"
          strokeWidth="2"
          className="text-border"
        />
      )}
      
      {/* Branch to father (top) */}
      {hasFather && (
        <path
          d={`M${width * 0.4} ${midY - branchGap} Q${width * 0.6} ${midY - branchGap}, ${width} ${midY - branchGap}`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-border"
          fill="none"
        />
      )}
      
      {/* Branch to mother (bottom) */}
      {hasMother && (
        <path
          d={`M${width * 0.4} ${midY + branchGap} Q${width * 0.6} ${midY + branchGap}, ${width} ${midY + branchGap}`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-border"
          fill="none"
        />
      )}
    </svg>
  );
}

interface SpouseConnectorProps {
  className?: string;
}

// Heart-shaped spouse connector
export function SpouseConnector({ className }: SpouseConnectorProps) {
  return (
    <svg className={cn("w-10 h-6", className)} viewBox="0 0 40 24" fill="none">
      {/* Left curve */}
      <path
        d="M0 12 Q8 12, 14 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-accent"
        fill="none"
      />
      {/* Heart */}
      <path
        d="M20 18 C16 14, 14 10, 16 8 C18 6, 20 8, 20 10 C20 8, 22 6, 24 8 C26 10, 24 14, 20 18"
        fill="currentColor"
        className="text-accent"
      />
      {/* Right curve */}
      <path
        d="M26 8 Q32 12, 40 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-accent"
        fill="none"
      />
    </svg>
  );
}

interface TreeConnectorSVGProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curveStrength?: number;
  className?: string;
}

// Generic curved path between two points
export function TreeConnectorPath({ fromX, fromY, toX, toY, curveStrength = 0.5, className }: TreeConnectorSVGProps) {
  const midY = (fromY + toY) / 2;
  const controlY1 = fromY + (toY - fromY) * curveStrength;
  const controlY2 = toY - (toY - fromY) * curveStrength;
  
  const path = `M${fromX} ${fromY} C${fromX} ${controlY1}, ${toX} ${controlY2}, ${toX} ${toY}`;
  
  return (
    <path
      d={path}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("text-border", className)}
      fill="none"
    />
  );
}

// Animated connector with gradient
export function AnimatedConnector({ className }: ConnectorLineProps) {
  return (
    <svg className={cn("w-2 h-8", className)} viewBox="0 0 8 32" fill="none">
      <defs>
        <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path
        d="M4 0 L4 32"
        stroke="url(#connectorGradient)"
        strokeWidth="2"
      />
    </svg>
  );
}
