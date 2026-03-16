import { memo, useMemo } from 'react';
import type { Person, Relationship } from '@/types';
import { FamilyMainView } from './FamilyMainView';
import { transformToFamilyChartData } from '../utils/familyChartMapper';

function getYearLabel(date?: string) {
  return date ? `${new Date(date).getFullYear()}` : 'Tahun tidak diketahui';
}

interface FamilyViewProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddRelationship?: (personId: string, type: 'parent' | 'spouse' | 'child') => void;
}

export const FamilyView = memo(function FamilyView({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onAddRelationship,
}: FamilyViewProps) {
  const selectedPerson = persons.find(p => p.id === selectedPersonId);

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

  const familyChartData = useMemo(() => {
    return transformToFamilyChartData(persons, relationships);
  }, [persons, relationships]);

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
    <div className="mx-auto flex h-full w-full max-w-[1700px] flex-col gap-6 px-6 py-8">
      <section className="rounded-[28px] border border-border/60 bg-background/88 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Fokus keluarga inti</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">{selectedPerson.fullName}</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Tampilan ini menonjolkan figur utama beserta orang tua, pasangan, saudara, dan anak yang langsung terhubung di sekitar pusat keluarga.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">Lahir {getYearLabel(selectedPerson.birthDate)}</span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">{familyData.children.length} anak</span>
            <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">{familyData.siblings.length} saudara</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FamilySnapshotCard label="Orang tua" value={familyData.parents.length} detail="Jalur asal keluarga" />
          <FamilySnapshotCard label="Pasangan" value={familyData.spouses.length} detail="Relasi rumah tangga" />
          <FamilySnapshotCard label="Anak" value={familyData.children.length} detail="Keturunan langsung" />
          <FamilySnapshotCard label="Saudara" value={familyData.siblings.length} detail="Berbagi orang tua" />
          <FamilySnapshotCard label="Kakek/Nenek" value={familyData.grandparents.length} detail="Generasi di atas orang tua" />
        </div>
      </section>

      <section className="flex-1 rounded-[30px] border border-border/60 bg-background/80 p-5 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Panggung keluarga</p>
            <p className="mt-1 text-sm text-muted-foreground">Klik kartu untuk memindahkan fokus, gunakan tombol kecil untuk lompat ke akar orang tua atau tambah anggota.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">Figur inti di-highlight</span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">Node lain mengikuti relasi terdekat</span>
          </div>
        </div>

        <FamilyMainView
          data={familyChartData}
          rootId={selectedPerson.id}
          rootPerson={selectedPerson}
          onSelectPerson={onSelectPerson}
          onAddRelationship={(id) => onAddRelationship?.(id, 'child')}
        />
      </section>
    </div>
  );
});

FamilyView.displayName = 'FamilyView';

interface FamilySnapshotCardProps {
  label: string;
  value: number;
  detail: string;
}

function FamilySnapshotCard({ label, value, detail }: FamilySnapshotCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
