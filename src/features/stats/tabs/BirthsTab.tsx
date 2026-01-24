import { useFamilyStore } from '@/store/familyStore';
import { calculateBirthStats } from '../utils/statsCalculations';
import { VerticalBarChart } from '../components/VerticalBarChart';
import { HorizontalBarChart } from '../components/HorizontalBarChart';
import { StatCard } from '../components/StatCard';
import { Baby, Calendar, Star } from 'lucide-react';

const zodiacEmojis: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

export function BirthsTab() {
  const { persons } = useFamilyStore();
  const stats = calculateBirthStats(persons);

  const personsWithBirthDate = persons.filter(p => p.birthDate).length;

  // Find most common month
  const mostCommonMonth = stats.monthDistribution.reduce((a, b) => 
    a.count > b.count ? a : b, { month: '-', count: 0 });

  // Find most common zodiac
  const mostCommonZodiac = stats.zodiacDistribution[0] || { sign: '-', count: 0 };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Data Kelahiran"
          value={personsWithBirthDate}
          subtitle={`${((personsWithBirthDate / persons.length) * 100).toFixed(0)}% dari total`}
          icon={Baby}
        />
        <StatCard
          title="Bulan Terpopuler"
          value={mostCommonMonth.month}
          subtitle={`${mostCommonMonth.count} kelahiran`}
          icon={Calendar}
        />
        <StatCard
          title="Zodiak Terbanyak"
          value={`${zodiacEmojis[mostCommonZodiac.sign] || ''} ${mostCommonZodiac.sign}`}
          subtitle={`${mostCommonZodiac.count} orang`}
          icon={Star}
        />
      </div>

      {/* Birth Months Chart */}
      <VerticalBarChart
        data={stats.monthDistribution.map(m => ({ name: m.month, value: m.count }))}
        title="Kelahiran per Bulan"
        color="hsl(var(--chart-1))"
        height={300}
      />

      {/* Zodiac and Decades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Distribusi Zodiak</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {stats.zodiacDistribution.map(({ sign, count }) => (
              <div key={sign} className="text-center p-3 bg-muted/50 rounded-lg">
                <span className="text-2xl">{zodiacEmojis[sign]}</span>
                <p className="text-xs font-medium mt-1">{sign}</p>
                <p className="text-lg font-bold text-primary">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <HorizontalBarChart
          data={stats.decadeDistribution.map(d => ({ name: d.decade, value: d.count }))}
          title="Kelahiran per Dekade"
          color="hsl(var(--chart-2))"
          showAllBars
        />
      </div>
    </div>
  );
}
