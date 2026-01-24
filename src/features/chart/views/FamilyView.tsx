import { useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { PersonNode, PlaceholderNode } from '../components/PersonNode';
import { Heart } from 'lucide-react';
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

  const familyData = useMemo(() => {
    if (!selectedPerson) return null;

    // Build relationship maps
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
    
    // Also get children from spouses
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

    // Sort children by birth date
    children.sort((a, b) => {
      const da = a.birthDate ? new Date(a.birthDate).getTime() : 0;
      const db = b.birthDate ? new Date(b.birthDate).getTime() : 0;
      return da - db;
    });

    // Get siblings (people who share at least one parent)
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

    // Get grandparents (parents of parents)
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
    <div className="flex flex-col items-center p-8 space-y-8 min-h-full">
      {/* Grandparents Row */}
      {familyData.grandparents.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Kakek/Nenek</div>
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
          {/* Connector */}
          <div className="w-px h-6 bg-border mt-3" />
        </div>
      )}

      {/* Parents Row */}
      <div className="flex flex-col items-center">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Orang Tua</div>
        <div className="flex items-center gap-3">
          {familyData.parents.length > 0 ? (
            familyData.parents.map((parent, idx) => (
              <div key={parent.id} className="flex items-center gap-2">
                {idx > 0 && <Heart className="w-4 h-4 text-accent fill-accent" />}
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
        {/* Connector */}
        <div className="w-px h-6 bg-border mt-3" />
      </div>

      {/* Selected Person + Spouse Row */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-3">
          {/* Siblings on the left */}
          {familyData.siblings.length > 0 && (
            <>
              <div className="flex flex-col items-center">
                <div className="text-xs text-muted-foreground mb-2">Saudara</div>
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
              <div className="w-8 h-px bg-border" />
            </>
          )}

          {/* Main person */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-primary font-semibold mb-2">★ Fokus</div>
            <div className="flex items-center gap-3">
              <PersonNode
                person={selectedPerson}
                isSelected={true}
                onClick={() => {}}
                size="large"
              />
              
              {/* Spouse(s) */}
              {familyData.spouses.length > 0 ? (
                familyData.spouses.map(spouse => (
                  <div key={spouse.id} className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-accent fill-accent" />
                    <PersonNode
                      person={spouse}
                      isSelected={false}
                      onClick={() => onSelectPerson(spouse.id)}
                      size="large"
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-muted-foreground/50" />
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
      </div>

      {/* Children Row */}
      <div className="flex flex-col items-center">
        {/* Connector */}
        <div className="w-px h-6 bg-border mb-3" />
        <div className="text-xs text-muted-foreground mb-2 font-medium">Anak</div>
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
  );
}
