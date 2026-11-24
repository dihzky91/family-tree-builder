import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChevronDown, ChevronUp, UserPlus, Pencil } from 'lucide-react';
import type { ApprovedMemberInfo, RelationToBranch } from '@/types';
import { formatShortYearLabel } from '@/lib/flexibleDateUtils';

interface ApprovedMembersCardProps {
  members: ApprovedMemberInfo[];
  branchName: string;
  onSelectMember?: (memberName: string) => void;
  onUpdateMember?: (member: ApprovedMemberInfo) => void;
}

export function formatRelationLabel(relation: RelationToBranch): string {
  switch (relation) {
    case 'child':
      return 'Anak';
    case 'grandchild':
      return 'Cucu';
    case 'great-grandchild':
      return 'Cicit';
    case 'other':
      return 'Pasangan / Lainnya';
    default:
      return relation;
  }
}

export function ApprovedMembersCard({
  members,
  branchName,
  onSelectMember,
  onUpdateMember,
}: ApprovedMembersCardProps) {
  const [showAll, setShowAll] = useState(false);
  const displayMembers = showAll ? members : members.slice(0, 6);

  if (members.length === 0) {
    return null;
  }

  return (
    <Card className="bg-success/5 border-success/25 p-4 sm:p-5 rounded-2xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success shrink-0" />
          <h3 className="font-semibold text-sm sm:text-base text-success">
            Anggota yang Sudah Terdaftar ({members.length})
          </h3>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground mb-3">
        Daftar anggota dari <span className="font-medium text-foreground">{branchName}</span> yang sudah masuk silsilah.
        {' '}Klik <strong>Lengkapi</strong> jika ingin menyusul mengisi tanggal lahir/biodata anggota tersebut, atau klik <strong>Hubungkan</strong> untuk menambah anak/pasangannya.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayMembers.map((member, i) => {
          const yearLabel = formatShortYearLabel(member.birthDate);
          return (
            <div
              key={`${member.fullName}-${i}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-success/20 bg-background/80 px-3 py-2 text-xs sm:text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium truncate">{member.fullName}</p>
                  {yearLabel ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {yearLabel}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-amber-400/60 text-amber-600 dark:text-amber-400"
                    >
                      Belum ada tgl lahir
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatRelationLabel(member.relationToBranch)}
                  {member.parentName ? ` · ${member.parentName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onUpdateMember && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateMember(member)}
                    title={`Lengkapi atau update biodata ${member.fullName}`}
                    className="h-7 px-2 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Lengkapi
                  </Button>
                )}
                {onSelectMember && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectMember(member.fullName)}
                    title={`Tambahkan anak atau pasangan dari ${member.fullName}`}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Hubungkan
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {members.length > 6 && (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-success hover:text-success hover:bg-success/10"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                Sembunyikan
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                Lihat semua ({members.length} anggota)
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
