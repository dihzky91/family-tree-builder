import { useMemo, useRef, useEffect, useState } from 'react';
import type { Person, Relationship } from '@/types';
import { PersonNode, PlaceholderNode } from '../components/PersonNode';
import { SpouseConnector } from '../components/ConnectorLines';
import { cn } from '@/lib/utils';

interface FamilyViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent' | 'spouse' | 'child') => void;
}

export function FamilyView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
}: FamilyViewProps) {
  const selectedPerson = persons.find(p => p.id === selectedPersonId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  }, [selectedPersonId]);

  const familyData = useMemo(() => {
    if (!selectedPerson) return null;

    const parents: Person[] = [];
    const spouses: Person[] = [];
    const children: Person[] = [];
    const siblings: Person[] = [];

    // Get parents
    const parentIds = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === selectedPerson.id)
      .map(r => r.fromPersonId);

    parentIds.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person) parents.push(person);
    });

    // Get spouses
    const spouseRels = relationships.filter(
      r => r.type === 'SPOUSE' && (r.fromPersonId === selectedPerson.id || r.toPersonId === selectedPerson.id)
    );
    spouseRels.forEach(r => {
      const spouseId = r.fromPersonId === selectedPerson.id ? r.toPersonId : r.fromPersonId;
      const person = persons.find(p => p.id === spouseId);
      if (person) spouses.push(person);
    });

    // Get children
    const childIds = relationships
      .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === selectedPerson.id)
      .map(r => r.toPersonId);

    spouses.forEach(spouse => {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.fromPersonId === spouse.id)
        .forEach(r => {
          if (!childIds.includes(r.toPersonId)) {
            childIds.push(r.toPersonId);
          }
        });
    });

    childIds.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person && !children.some(c => c.id === id)) {
        children.push(person);
      }
    });

    children.sort((a, b) => {
      const da = a.birthDate ? new Date(a.birthDate).getTime() : 0;
      const db = b.birthDate ? new Date(b.birthDate).getTime() : 0;
      return da - db;
    });

    // Get siblings
    if (parentIds.length > 0) {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && parentIds.includes(r.fromPersonId) && r.toPersonId !== selectedPerson.id)
        .forEach(r => {
          const person = persons.find(p => p.id === r.toPersonId);
          if (person && !siblings.some(s => s.id === person.id)) {
            siblings.push(person);
          }
        });
    }

    // Get grandparents
    const grandparents: Person[] = [];
    parents.forEach(parent => {
      relationships
        .filter(r => r.type === 'PARENT_CHILD' && r.toPersonId === parent.id)
        .forEach(r => {
          const person = persons.find(p => p.id === r.fromPersonId);
          if (person && !grandparents.some(g => g.id === person.id)) {
            grandparents.push(person);
          }
        });
    });

    return { parents, spouses, children, siblings, grandparents };
  }, [selectedPerson, persons, relationships]);

  if (!selectedPerson || !familyData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <div className="text-center">
          <p className="mb-2">Pilih anggota keluarga untuk melihat Family View</p>
          <p className="text-sm">Klik pada salah satu nama di daftar atau gunakan pencarian</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-center p-8 min-h-full">
      {/* SVG Layer for connector lines */}
      <svg
        className="absolute inset-0 pointer-events-none z-0"
        width="100%"
        height="100%"
        style={{ minHeight: '600px' }}
      >
        <defs>
          {/* Gradient for lines */}
          <linearGradient id="familyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          </linearGradient>

          {/* Arrow marker for directed relationships */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--primary))" opacity="0.7" />
          </marker>

          {/* Glow effect */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow for depth */}
          <filter id="lineShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grandparents to Parents connector */}
        {familyData.grandparents.length > 0 && familyData.parents.length > 0 && (
          <g className="animate-fade-in">
            <path
              d={`M ${dimensions.width / 2} 95 
                  Q ${dimensions.width / 2} 120, ${dimensions.width / 2} 145`}
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-300"
              opacity="0.6"
              filter="url(#lineShadow)"
              markerEnd="url(#arrowhead)"
            />
            <circle
              cx={dimensions.width / 2}
              cy="95"
              r="4"
              fill="hsl(var(--primary))"
              opacity="0.8"
            />
          </g>
        )}

        {/* Parents to Selected Person connector */}
        {familyData.parents.length > 0 && (
          <g className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <path
              d={`M ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 215 : 115} 
                  C ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 245 : 145},
                    ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 275 : 175},
                    ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 295 : 195}`}
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className="transition-all duration-300"
              opacity="0.7"
              filter="url(#lineShadow)"
              markerEnd="url(#arrowhead)"
            />
            <circle
              cx={dimensions.width / 2}
              cy={familyData.grandparents.length > 0 ? 215 : 115}
              r="4"
              fill="hsl(var(--primary))"
              opacity="0.8"
            />
          </g>
        )}

        {/* Selected Person to Children connector */}
        {familyData.children.length > 0 && (
          <g className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Main vertical line */}
            <path
              d={`M ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 420 : familyData.parents.length > 0 ? 320 : 220}
                  L ${dimensions.width / 2} ${familyData.grandparents.length > 0 ? 460 : familyData.parents.length > 0 ? 360 : 260}`}
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
              filter="url(#lineShadow)"
            />

            {/* Horizontal branch line if multiple children */}
            {familyData.children.length > 1 && (
              <path
                d={`M ${dimensions.width / 2 - (familyData.children.length - 1) * 75} ${familyData.grandparents.length > 0 ? 460 : familyData.parents.length > 0 ? 360 : 260}
                    L ${dimensions.width / 2 + (familyData.children.length - 1) * 75} ${familyData.grandparents.length > 0 ? 460 : familyData.parents.length > 0 ? 360 : 260}`}
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                opacity="0.6"
                filter="url(#lineShadow)"
              />
            )}

            {/* Individual lines to each child */}
            {familyData.children.map((_, i) => {
              const childX = familyData.children.length === 1
                ? dimensions.width / 2
                : dimensions.width / 2 - ((familyData.children.length - 1) * 75) + (i * 150);
              const baseY = familyData.grandparents.length > 0 ? 460 : familyData.parents.length > 0 ? 360 : 260;

              return (
                <g key={i}>
                  <path
                    d={`M ${childX} ${baseY} 
                        C ${childX} ${baseY + 15}, ${childX} ${baseY + 25}, ${childX} ${baseY + 40}`}
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.6"
                    filter="url(#lineShadow)"
                    markerEnd="url(#arrowhead)"
                  />
                  <circle cx={childX} cy={baseY} r="4" fill="hsl(var(--primary))" opacity="0.7" />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        {/* Grandparents Row */}
        {familyData.grandparents.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Kakek/Nenek</div>
            <div className="flex gap-4 flex-wrap justify-center">
              {familyData.grandparents.map(person => (
                <PersonNode
                  key={person.id}
                  person={person}
                  isSelected={false}
                  onClick={() => onSelectPerson(person.id)}
                  size="small"
                />
              ))}
            </div>
          </div>
        )}

        {/* Parents Row */}
        <div className="flex flex-col items-center" style={{ marginTop: familyData.grandparents.length > 0 ? '2rem' : 0 }}>
          <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Orang Tua</div>
          <div className="flex items-center gap-2">
            {familyData.parents.length > 0 ? (
              familyData.parents.map((parent, idx) => (
                <div key={parent.id} className="flex items-center">
                  {idx > 0 && <SpouseConnector className="mx-1" />}
                  <PersonNode
                    person={parent}
                    isSelected={false}
                    onClick={() => onSelectPerson(parent.id)}
                  />
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3">
                <PlaceholderNode
                  label="Tambah Ayah"
                  onClick={() => onAddRelationship?.(selectedPerson.id, 'parent')}
                />
                <PlaceholderNode
                  label="Tambah Ibu"
                  onClick={() => onAddRelationship?.(selectedPerson.id, 'parent')}
                />
              </div>
            )}
          </div>
        </div>

        {/* Selected Person + Siblings + Spouse Row */}
        <div className="flex items-center gap-4" style={{ marginTop: '2rem' }}>
          {/* Siblings on the left */}
          {familyData.siblings.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Saudara</div>
              <div className="flex gap-2 flex-wrap justify-center max-w-[200px]">
                {familyData.siblings.map(sibling => (
                  <PersonNode
                    key={sibling.id}
                    person={sibling}
                    isSelected={false}
                    onClick={() => onSelectPerson(sibling.id)}
                    size="small"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sibling connector */}
          {familyData.siblings.length > 0 && (
            <svg className="w-12 h-2" viewBox="0 0 48 8">
              <path
                d="M0 4 Q12 4, 24 4 T48 4"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="2"
                strokeDasharray="6 3"
                fill="none"
                opacity="0.5"
              />
            </svg>
          )}

          {/* Main person + spouse */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-primary font-semibold mb-2 flex items-center gap-1">
              <span className="text-accent">★</span> Fokus
            </div>
            <div className="flex items-center">
              <PersonNode
                person={selectedPerson}
                isSelected={true}
                onClick={() => { }}
                size="large"
              />

              {/* Spouse(s) */}
              {familyData.spouses.length > 0 ? (
                familyData.spouses.map(spouse => (
                  <div key={spouse.id} className="flex items-center">
                    <SpouseConnector className="mx-1" />
                    <PersonNode
                      person={spouse}
                      isSelected={false}
                      onClick={() => onSelectPerson(spouse.id)}
                      size="large"
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center">
                  <svg className="w-8 h-2 mx-1" viewBox="0 0 32 8">
                    <path d="M0 4 L32 4" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" />
                  </svg>
                  <PlaceholderNode
                    label="Tambah Pasangan"
                    onClick={() => onAddRelationship?.(selectedPerson.id, 'spouse')}
                    size="large"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Children Row */}
        <div className="flex flex-col items-center" style={{ marginTop: '2rem' }}>
          <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Anak</div>
          <div className="flex gap-3 flex-wrap justify-center max-w-2xl">
            {familyData.children.length > 0 ? (
              familyData.children.map(child => (
                <PersonNode
                  key={child.id}
                  person={child}
                  isSelected={false}
                  onClick={() => onSelectPerson(child.id)}
                />
              ))
            ) : (
              <PlaceholderNode
                label="Tambah Anak"
                onClick={() => onAddRelationship?.(selectedPerson.id, 'child')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
