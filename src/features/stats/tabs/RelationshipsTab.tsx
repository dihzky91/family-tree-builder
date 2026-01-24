import { useFamilyStore } from '@/store/familyStore';
import { calculateRelationshipSteps } from '../utils/statsCalculations';
import { HorizontalBarChart } from '../components/HorizontalBarChart';
import { StatCard } from '../components/StatCard';
import { GitBranch, Users, Heart } from 'lucide-react';
import { useMemo } from 'react';

export function RelationshipsTab() {
  const { persons, relationships, selectedPersonId } = useFamilyStore();

  const focusPersonId = selectedPersonId || persons[0]?.id;
  const focusPerson = persons.find(p => p.id === focusPersonId);

  const stepsMap = useMemo(() => 
    calculateRelationshipSteps(persons, relationships, focusPersonId || ''),
    [persons, relationships, focusPersonId]
  );

  // Calculate steps distribution
  const stepsDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    stepsMap.forEach((steps) => {
      if (steps === 0) return; // Skip focus person
      const key = steps <= 5 ? `${steps} langkah` : '6+ langkah';
      dist[key] = (dist[key] || 0) + 1;
    });
    return Object.entries(dist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const aNum = parseInt(a.name);
        const bNum = parseInt(b.name);
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return aNum - bNum;
      });
  }, [stepsMap]);

  // Calculate relationship types
  const relationshipTypes = useMemo(() => {
    const parentChild = relationships.filter(r => r.type === 'PARENT_CHILD').length;
    const spouse = relationships.filter(r => r.type === 'SPOUSE').length;
    return [
      { name: 'Orang Tua - Anak', value: parentChild },
      { name: 'Pasangan', value: spouse },
    ];
  }, [relationships]);

  // Connected vs isolated
  const connectedCount = stepsMap.size;
  const isolatedCount = persons.length - connectedCount;

  return (
    <div className="space-y-6">
      {/* Focus Person Info */}
      {focusPerson && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            Statistik dihitung berdasarkan jarak dari:{' '}
            <span className="font-semibold text-foreground">{focusPerson.fullName}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih anggota keluarga di halaman Silsilah untuk mengubah fokus.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Relasi"
          value={relationships.length}
          subtitle="Hubungan tercatat"
          icon={GitBranch}
        />
        <StatCard
          title="Terhubung"
          value={connectedCount}
          subtitle="Anggota dalam jaringan"
          icon={Users}
        />
        <StatCard
          title="Relasi Pasangan"
          value={relationships.filter(r => r.type === 'SPOUSE').length}
          subtitle="Pernikahan/kemitraan"
          icon={Heart}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HorizontalBarChart
          data={stepsDistribution}
          title="Jarak dari Fokus Person"
          color="hsl(var(--chart-1))"
        />
        <HorizontalBarChart
          data={relationshipTypes}
          title="Tipe Relasi"
          color="hsl(var(--chart-2))"
        />
      </div>

      {/* Isolated members warning */}
      {isolatedCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <strong>{isolatedCount} anggota</strong> tidak terhubung dengan {focusPerson?.fullName || 'fokus person'}.
            Tambahkan relasi untuk menghubungkan mereka ke silsilah.
          </p>
        </div>
      )}
    </div>
  );
}
