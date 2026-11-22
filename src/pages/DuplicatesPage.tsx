import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import {
  findAllDuplicates,
  getIgnoredDuplicatePairs,
  addIgnoredDuplicatePair,
  removeIgnoredDuplicatePair,
  makePairKey,
  type DuplicateCandidate,
} from '@/lib/duplicateDetection';
import { getPersonInitials } from '@/features/people/components/PersonDetailSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  AlertTriangle,
  Check,
  X,
  GitMerge,
  Calendar,
  RefreshCw,
  MapPin,
  Link2,
  GitBranch,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { MergeWizard } from '@/features/duplicates/MergeWizard';
import { toast } from 'sonner';

type SensitivityLevel = 'strict' | 'normal' | 'loose';

const SENSITIVITY_SCORE: Record<SensitivityLevel, number> = {
  strict: 75,
  normal: 55,
  loose: 45,
};

export default function DuplicatesPage() {
  const { persons, relationships } = useFamilyStore();
  const navigate = useNavigate();

  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(() => getIgnoredDuplicatePairs());
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('normal');
  const [activeTab, setActiveTab] = useState<'pending' | 'ignored'>('pending');
  const [selectedCandidate, setSelectedCandidate] = useState<DuplicateCandidate | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const relationCountMap = useMemo(() => {
    const map = new Map<string, number>();
    relationships.forEach((r) => {
      map.set(r.fromPersonId, (map.get(r.fromPersonId) || 0) + 1);
      map.set(r.toPersonId, (map.get(r.toPersonId) || 0) + 1);
    });
    return map;
  }, [relationships]);

  const allCandidates = useMemo(() => {
    void refreshKey;
    return findAllDuplicates(persons, {
      relationships,
      minScore: SENSITIVITY_SCORE[sensitivity],
      includeIgnored: true,
    });
  }, [persons, relationships, sensitivity, refreshKey]);

  const pendingDuplicates = useMemo(
    () =>
      allCandidates.filter(
        (d) => !ignoredPairs.has(makePairKey(d.person1.id, d.person2.id))
      ),
    [allCandidates, ignoredPairs]
  );

  const ignoredDuplicates = useMemo(
    () =>
      allCandidates.filter((d) =>
        ignoredPairs.has(makePairKey(d.person1.id, d.person2.id))
      ),
    [allCandidates, ignoredPairs]
  );

  const handleIgnore = (candidate: DuplicateCandidate) => {
    const key = makePairKey(candidate.person1.id, candidate.person2.id);
    setIgnoredPairs(addIgnoredDuplicatePair(key));
    toast.success('Pasangan ditandai bukan duplikat');
  };

  const handleRestore = (candidate: DuplicateCandidate) => {
    const key = makePairKey(candidate.person1.id, candidate.person2.id);
    setIgnoredPairs(removeIgnoredDuplicatePair(key));
    toast.success('Pasangan dikembalikan ke daftar duplikat');
  };

  const handleMergeComplete = () => {
    setSelectedCandidate(null);
    setRefreshKey((k) => k + 1);
  };

  const getScoreBadgeVariant = (score: number): 'destructive' | 'secondary' | 'outline' => {
    if (score >= 80) return 'destructive';
    if (score >= 65) return 'secondary';
    return 'outline';
  };

  const displayedList = activeTab === 'pending' ? pendingDuplicates : ignoredDuplicates;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Deteksi Duplikat
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Temukan dan gabungkan data anggota yang terindikasi ganda secara akurat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sensitivity}
            onValueChange={(v) => setSensitivity(v as SensitivityLevel)}
          >
            <SelectTrigger className="h-9 w-[170px] text-xs rounded-xl">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Ketat (≥ 75%)</SelectItem>
              <SelectItem value="normal">Normal (≥ 55%)</SelectItem>
              <SelectItem value="loose">Longgar (≥ 45%)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Scan Ulang
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold leading-tight">{persons.length}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Total Anggota</p>
            </div>
          </div>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold leading-tight">{pendingDuplicates.length}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Potensi Duplikat</p>
            </div>
          </div>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold leading-tight">{ignoredDuplicates.length}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Diabaikan</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs: Pending vs Ignored */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'ignored')}>
        <TabsList className="grid w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="pending">
            Potensi Duplikat ({pendingDuplicates.length})
          </TabsTrigger>
          <TabsTrigger value="ignored">
            Diabaikan ({ignoredDuplicates.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Duplicates List */}
      {displayedList.length === 0 ? (
        <Card className="p-10 sm:p-12 text-center rounded-2xl">
          <Check className="w-12 h-12 text-success mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1.5">
            {activeTab === 'pending'
              ? 'Tidak Ada Duplikat Terdeteksi'
              : 'Belum Ada Pasangan Diabaikan'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {activeTab === 'pending'
              ? 'Data anggota keluarga Anda bersih! Pasangan dengan gender berbeda, jarak lahir > 5 tahun, atau sudah berelasi langsung otomatis dikecualikan.'
              : 'Pasangan yang Anda klik "Abaikan" akan muncul di sini dan dapat dipulihkan kapan saja.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {displayedList.map((candidate) => (
            <DuplicateCard
              key={makePairKey(candidate.person1.id, candidate.person2.id)}
              candidate={candidate}
              isIgnored={activeTab === 'ignored'}
              relCount1={relationCountMap.get(candidate.person1.id) || 0}
              relCount2={relationCountMap.get(candidate.person2.id) || 0}
              onMerge={() => setSelectedCandidate(candidate)}
              onIgnore={() => handleIgnore(candidate)}
              onRestore={() => handleRestore(candidate)}
              onViewInChart={(personId) => navigate(`/chart?focus=${personId}`)}
              getScoreBadgeVariant={getScoreBadgeVariant}
            />
          ))}
        </div>
      )}

      {/* Merge Wizard Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <GitMerge className="w-5 h-5 text-primary" />
              Merge Wizard
            </DialogTitle>
            <DialogDescription>
              Pilih data mana yang ingin disimpan dari masing-masing anggota
            </DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <MergeWizard
              candidate={selectedCandidate}
              onComplete={handleMergeComplete}
              onCancel={() => setSelectedCandidate(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DuplicateCardProps {
  candidate: DuplicateCandidate;
  isIgnored: boolean;
  relCount1: number;
  relCount2: number;
  onMerge: () => void;
  onIgnore: () => void;
  onRestore: () => void;
  onViewInChart: (personId: string) => void;
  getScoreBadgeVariant: (score: number) => 'destructive' | 'secondary' | 'outline';
}

function DuplicateCard({
  candidate,
  isIgnored,
  relCount1,
  relCount2,
  onMerge,
  onIgnore,
  onRestore,
  onViewInChart,
  getScoreBadgeVariant,
}: DuplicateCardProps) {
  const { person1, person2, score, reasons } = candidate;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Tidak tercatat';
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const genderLabels: Record<string, string> = {
    male: 'Laki-laki',
    female: 'Perempuan',
    unknown: 'Tidak diketahui',
  };

  const renderPersonBox = (person: DuplicateCandidate['person1'], relCount: number) => {
    const location = person.residence || person.birthPlace;
    return (
      <div className="p-3 bg-muted/45 rounded-xl border border-border/50 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ${
                person.gender === 'male'
                  ? 'bg-node-male/20 text-node-male'
                  : person.gender === 'female'
                    ? 'bg-node-female/20 text-node-female'
                    : 'bg-node-unknown/20 text-node-unknown'
              }`}
            >
              {person.photoUrl ? (
                <img src={person.photoUrl} alt={person.fullName} className="w-full h-full object-cover" />
              ) : (
                getPersonInitials(person.fullName)
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{person.fullName}</p>
              <p className="text-xs text-muted-foreground">{genderLabels[person.gender]}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
            title="Lihat di Silsilah"
            aria-label={`Lihat ${person.fullName} di silsilah`}
            onClick={() => onViewInChart(person.id)}
          >
            <GitBranch className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="text-xs space-y-1 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Lahir: {formatDate(person.birthDate)}</span>
          </div>
          {location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3 h-3 shrink-0" />
            <span>{relCount} relasi terhubung</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4 rounded-2xl hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Score Badge */}
        <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center lg:min-w-[84px] gap-2">
          <div className="flex items-center lg:flex-col gap-2 lg:gap-1">
            <Badge variant={getScoreBadgeVariant(score)} className="text-base sm:text-lg px-3 py-0.5">
              {score}%
            </Badge>
            <span className="text-xs text-muted-foreground">Kemiripan</span>
          </div>
        </div>

        {/* Person Comparison */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderPersonBox(person1, relCount1)}
          {renderPersonBox(person2, relCount2)}
        </div>

        {/* Actions */}
        <div className="flex lg:flex-col gap-2 justify-end shrink-0">
          <Button onClick={onMerge} size="sm" className="flex-1 lg:flex-none">
            <GitMerge className="w-4 h-4 mr-1.5" />
            Merge
          </Button>
          {isIgnored ? (
            <Button variant="outline" onClick={onRestore} size="sm" className="flex-1 lg:flex-none">
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Pulihkan
            </Button>
          ) : (
            <Button variant="outline" onClick={onIgnore} size="sm" className="flex-1 lg:flex-none">
              <X className="w-4 h-4 mr-1.5" />
              Abaikan
            </Button>
          )}
        </div>
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
          {reasons.map((reason, i) => (
            <Badge key={i} variant="outline" className="text-[11px] font-normal">
              {reason}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}
