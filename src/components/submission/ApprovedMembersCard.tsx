import { Card } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { ApprovedMemberInfo } from '@/types';

interface ApprovedMembersCardProps {
    members: ApprovedMemberInfo[];
    branchName: string;
}

export function ApprovedMembersCard({ members, branchName }: ApprovedMembersCardProps) {
    const [showAll, setShowAll] = useState(false);
    const displayMembers = showAll ? members : members.slice(0, 5);

    if (members.length === 0) {
        return null;
    }

    return (
        <Card className="bg-success/5 border-success/20 p-6">
            <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-success" />
                <h3 className="font-semibold text-success">Anggota yang sudah terdaftar</h3>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
                Berikut adalah anggota dari <span className="font-medium">{branchName}</span> yang sudah mengisi data:
            </p>

            <div className="space-y-2 mb-4">
                {displayMembers.map((member, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-success mt-2 shrink-0" />
                        <div>
                            <span className="font-medium">{member.fullName}</span>
                            <span className="text-muted-foreground">
                                {' '}({member.relationToBranch}
                                {member.parentName && ` dari ${member.parentName}`})
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {members.length > 5 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAll(!showAll)}
                    className="text-success hover:text-success hover:bg-success/10"
                >
                    {showAll ? 'Sembunyikan' : `Lihat semua (${members.length} anggota)`}
                </Button>
            )}

            <div className="mt-4 pt-4 border-t border-success/20">
                <p className="text-xs text-muted-foreground">
                    Total: <span className="font-medium text-success">{members.length}</span> anggota terdaftar
                </p>
            </div>
        </Card>
    );
}
