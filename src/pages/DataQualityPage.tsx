import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { checkDataQuality, type DataIssue } from '@/lib/dataQuality';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Stethoscope,
  Pencil,
  Link2,
  GitBranch,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PersonForm } from '@/features/people/PersonForm';
import { RelationshipForm } from '@/features/relationships/RelationshipForm';

type IssueFilter = 'all' | 'error' | 'warning' | 'info';

export default function DataQualityPage() {
  const { persons, relationships } = useFamilyStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<IssueFilter>('all');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [linkingPersonId, setLinkingPersonId] = useState<string | null>(null);

  const issues = useMemo(
    () => checkDataQuality(persons, relationships),
    [persons, relationships]
  );

  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;
  const infoCount = issues.filter((i) => i.type === 'info').length;

  const visibleIssues = useMemo(
    () => (filter === 'all' ? issues : issues.filter((i) => i.type === filter)),
    [issues, filter]
  );

  const editingPerson = persons.find((p) => p.id === editingPersonId);
  const getPersonName = (id: string) => persons.find((p) => p.id === id)?.fullName || 'Anggota';

  const IssueCard = ({ issue }: { issue: DataIssue }) => {
    const Icon = issue.type === 'info' ? Info : AlertTriangle;
    const color =
      issue.type === 'error'
        ? 'text-destructive'
        : issue.type === 'warning'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-blue-600 dark:text-blue-400';
    const bgColor =
      issue.type === 'error'
        ? 'bg-destructive/5'
        : issue.type === 'warning'
          ? 'bg-amber-500/5'
          : 'bg-blue-500/5';
    const borderColor =
      issue.type === 'error'
        ? 'border-destructive/25'
        : issue.type === 'warning'
          ? 'border-amber-500/25'
          : 'border-blue-500/25';

    return (
      <div className={`p-4 rounded-2xl border ${bgColor} ${borderColor} flex gap-3 items-start`}>
        <div className={`mt-0.5 p-1.5 rounded-full bg-background border shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-sm">{issue.title}</h3>
            <Badge variant="outline" className="text-[11px] bg-background">
              {getPersonName(issue.personId)}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-foreground/80 mb-3">{issue.description}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-background"
              onClick={() => setEditingPersonId(issue.personId)}
            >
              <Pencil className="w-3 h-3 mr-1.5" />
              Edit Data
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-background"
              onClick={() => setLinkingPersonId(issue.personId)}
            >
              <Link2 className="w-3 h-3 mr-1.5" />
              Hubungkan Relasi
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-primary"
              onClick={() => navigate(`/chart?focus=${issue.personId}`)}
            >
              <GitBranch className="w-3 h-3 mr-1.5" />
              Lihat di Silsilah
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-2.5">
          <Stethoscope className="w-7 h-7 text-primary shrink-0" />
          Kesehatan Data
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deteksi otomatis masalah, inkonsistensi, dan perbaiki langsung dari satu tempat
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card
          onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
          className="p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 bg-destructive/5 border-destructive/20 cursor-pointer hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold leading-tight">{errorCount}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Kritis</p>
          </div>
        </Card>
        <Card
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className="p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 bg-amber-500/5 border-amber-500/20 cursor-pointer hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold leading-tight">{warningCount}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Peringatan</p>
          </div>
        </Card>
        <Card
          onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}
          className="p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 bg-blue-500/5 border-blue-500/20 cursor-pointer hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Info className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold leading-tight">{infoCount}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Saran</p>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      {issues.length > 0 && (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as IssueFilter)}>
          <TabsList className="grid w-full grid-cols-4 sm:w-[420px]">
            <TabsTrigger value="all" className="text-xs">
              Semua ({issues.length})
            </TabsTrigger>
            <TabsTrigger value="error" className="text-xs">
              Kritis ({errorCount})
            </TabsTrigger>
            <TabsTrigger value="warning" className="text-xs">
              Peringatan ({warningCount})
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs">
              Saran ({infoCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {visibleIssues.length > 0 ? (
        <div className="grid gap-3">
          {visibleIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="py-16 px-4 text-center border-2 border-dashed rounded-2xl bg-muted/30">
          <CheckCircle className="w-14 h-14 mx-auto mb-3 text-green-500" />
          <h2 className="text-xl font-bold text-foreground">
            {issues.length === 0 ? 'Data Sehat!' : 'Tidak ada temuan di kategori ini'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            {issues.length === 0
              ? 'Tidak ditemukan masalah atau inkonsistensi pada data silsilah Anda.'
              : 'Coba pilih kategori lain di atas.'}
          </p>
        </div>
      )}

      {/* Edit Person Dialog */}
      <Dialog open={!!editingPersonId} onOpenChange={(open) => !open && setEditingPersonId(null)}>
        <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Perbaiki Data Anggota</DialogTitle>
          </DialogHeader>
          <PersonForm person={editingPerson} onSuccess={() => setEditingPersonId(null)} />
        </DialogContent>
      </Dialog>

      {/* Quick Link Relationship Dialog */}
      <Dialog open={!!linkingPersonId} onOpenChange={(open) => !open && setLinkingPersonId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Hubungkan Relasi Keluarga</DialogTitle>
            <DialogDescription>
              Sambungkan <strong>{linkingPersonId ? getPersonName(linkingPersonId) : ''}</strong> dengan orang tua, pasangan, atau anak.
            </DialogDescription>
          </DialogHeader>
          {linkingPersonId && (
            <RelationshipForm
              key={linkingPersonId}
              preselectedPersonId={linkingPersonId}
              onSuccess={() => setLinkingPersonId(null)}
              onCancel={() => setLinkingPersonId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
