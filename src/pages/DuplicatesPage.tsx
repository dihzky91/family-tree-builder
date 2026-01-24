import { useState, useMemo } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { findAllDuplicates, type DuplicateCandidate } from '@/lib/duplicateDetection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  User,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { MergeWizard } from '@/features/duplicates/MergeWizard';

export default function DuplicatesPage() {
  const { persons } = useFamilyStore();
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());
  const [selectedCandidate, setSelectedCandidate] = useState<DuplicateCandidate | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const duplicates = useMemo(() => {
    // Trigger recalculation when refreshKey changes
    void refreshKey;
    return findAllDuplicates(persons);
  }, [persons, refreshKey]);

  const visibleDuplicates = duplicates.filter(d => {
    const pairKey = [d.person1.id, d.person2.id].sort().join('-');
    return !ignoredPairs.has(pairKey);
  });

  const handleIgnore = (candidate: DuplicateCandidate) => {
    const pairKey = [candidate.person1.id, candidate.person2.id].sort().join('-');
    setIgnoredPairs(prev => new Set([...prev, pairKey]));
  };

  const handleMergeComplete = () => {
    setSelectedCandidate(null);
    setRefreshKey(k => k + 1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-destructive';
    if (score >= 60) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getScoreBadgeVariant = (score: number): 'destructive' | 'secondary' | 'outline' => {
    if (score >= 80) return 'destructive';
    if (score >= 60) return 'secondary';
    return 'outline';
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Deteksi Duplikat
          </h1>
          <p className="text-muted-foreground mt-1">
            Temukan dan gabungkan data anggota yang mungkin duplikat
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setRefreshKey(k => k + 1)}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Scan Ulang
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{persons.length}</p>
              <p className="text-sm text-muted-foreground">Total Anggota</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{visibleDuplicates.length}</p>
              <p className="text-sm text-muted-foreground">Potensi Duplikat</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <X className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ignoredPairs.size}</p>
              <p className="text-sm text-muted-foreground">Diabaikan</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Duplicates List */}
      {visibleDuplicates.length === 0 ? (
        <Card className="p-12 text-center">
          <Check className="w-12 h-12 text-success mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tidak Ada Duplikat Terdeteksi</h3>
          <p className="text-muted-foreground">
            {duplicates.length > 0 
              ? `Semua ${duplicates.length} potensi duplikat sudah ditinjau.`
              : 'Data anggota keluarga Anda sudah bersih!'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleDuplicates.map((candidate, idx) => (
            <DuplicateCard
              key={`${candidate.person1.id}-${candidate.person2.id}`}
              candidate={candidate}
              onMerge={() => setSelectedCandidate(candidate)}
              onIgnore={() => handleIgnore(candidate)}
              getScoreColor={getScoreColor}
              getScoreBadgeVariant={getScoreBadgeVariant}
            />
          ))}
        </div>
      )}

      {/* Merge Wizard Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
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
  onMerge: () => void;
  onIgnore: () => void;
  getScoreColor: (score: number) => string;
  getScoreBadgeVariant: (score: number) => 'destructive' | 'secondary' | 'outline';
}

function DuplicateCard({ candidate, onMerge, onIgnore, getScoreColor, getScoreBadgeVariant }: DuplicateCardProps) {
  const { person1, person2, score, reasons, fieldMatches } = candidate;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const genderLabels: Record<string, string> = {
    male: 'Laki-laki',
    female: 'Perempuan',
    unknown: 'Tidak diketahui'
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Score Badge */}
        <div className="flex flex-col items-center justify-center min-w-[80px]">
          <Badge variant={getScoreBadgeVariant(score)} className="text-lg px-3 py-1">
            {score}%
          </Badge>
          <span className="text-xs text-muted-foreground mt-1">Kemiripan</span>
        </div>

        {/* Person Comparison */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Person 1 */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center
                ${person1.gender === 'male' ? 'bg-node-male/20 text-node-male' : 
                  person1.gender === 'female' ? 'bg-node-female/20 text-node-female' : 
                  'bg-node-unknown/20 text-node-unknown'}`}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">{person1.fullName}</p>
                <p className="text-xs text-muted-foreground">{genderLabels[person1.gender]}</p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Lahir: {formatDate(person1.birthDate)}
              </div>
              {person1.deathDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Wafat: {formatDate(person1.deathDate)}
                </div>
              )}
            </div>
          </div>

          {/* Person 2 */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center
                ${person2.gender === 'male' ? 'bg-node-male/20 text-node-male' : 
                  person2.gender === 'female' ? 'bg-node-female/20 text-node-female' : 
                  'bg-node-unknown/20 text-node-unknown'}`}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium">{person2.fullName}</p>
                <p className="text-xs text-muted-foreground">{genderLabels[person2.gender]}</p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Lahir: {formatDate(person2.birthDate)}
              </div>
              {person2.deathDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Wafat: {formatDate(person2.deathDate)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex lg:flex-col gap-2 justify-end">
          <Button onClick={onMerge} size="sm">
            <GitMerge className="w-4 h-4 mr-2" />
            Merge
          </Button>
          <Button variant="outline" onClick={onIgnore} size="sm">
            <X className="w-4 h-4 mr-2" />
            Abaikan
          </Button>
        </div>
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex flex-wrap gap-2">
            {reasons.map((reason, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
