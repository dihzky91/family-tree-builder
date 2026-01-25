import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { checkDataQuality, type DataIssue } from '@/lib/dataQuality';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, Stethoscope, ArrowRight, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/features/people/PersonForm';
import { calculateRelationship } from '@/lib/relationshipCalculator';

export default function DataQualityPage() {
    const { persons, relationships } = useFamilyStore();
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

    const issues = checkDataQuality(persons, relationships);
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    const infoCount = issues.filter(i => i.type === 'info').length;

    const editingPerson = persons.find(p => p.id === editingPersonId);

    const getPersonName = (id: string) => persons.find(p => p.id === id)?.fullName || 'Unknown';

    const IssueCard = ({ issue }: { issue: DataIssue }) => {
        const Icon = issue.type === 'error' ? AlertTriangle : issue.type === 'warning' ? AlertTriangle : Info;
        const color = issue.type === 'error' ? 'text-destructive' : issue.type === 'warning' ? 'text-yellow-500' : 'text-blue-500';
        const bgColor = issue.type === 'error' ? 'bg-destructive/10' : issue.type === 'warning' ? 'bg-yellow-500/10' : 'bg-blue-500/10';
        const borderColor = issue.type === 'error' ? 'border-destructive/20' : issue.type === 'warning' ? 'border-yellow-500/20' : 'border-blue-500/20';

        return (
            <div className={`p-4 rounded-lg border ${bgColor} ${borderColor} flex gap-4 items-start`}>
                <div className={`mt-0.5 p-1.5 rounded-full bg-background ${color}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{issue.title}</h3>
                        <Badge variant="outline" className="text-[10px] bg-background">
                            {getPersonName(issue.personId)}
                        </Badge>
                    </div>
                    <p className="text-sm text-foreground/80 mb-2">
                        {issue.description}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-background hover:bg-background/80"
                        onClick={() => setEditingPersonId(issue.personId)}
                    >
                        Perbaiki
                        <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                    <Stethoscope className="w-8 h-8 text-primary" />
                    Analisis Kesehatan Data
                </h1>
                <p className="text-muted-foreground mt-1">
                    Deteksi otomatis masalah dan inkonsistensi pada data silsilah
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4 bg-destructive/5 border-destructive/20">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{errorCount}</p>
                        <p className="text-sm text-muted-foreground">Masalah Kritis</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 bg-yellow-500/5 border-yellow-500/20">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{warningCount}</p>
                        <p className="text-sm text-muted-foreground">Peringatan</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4 bg-blue-500/5 border-blue-500/20">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{infoCount}</p>
                        <p className="text-sm text-muted-foreground">Saran</p>
                    </div>
                </Card>
            </div>

            {issues.length > 0 ? (
                <div className="space-y-6">
                    {errorCount > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-destructive">
                                <AlertTriangle className="w-4 h-4" /> Masalah Kritis
                            </h2>
                            <div className="grid gap-3">
                                {issues.filter(i => i.type === 'error').map(issue => (
                                    <IssueCard key={issue.id} issue={issue} />
                                ))}
                            </div>
                        </section>
                    )}

                    {warningCount > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-yellow-500">
                                <AlertTriangle className="w-4 h-4" /> Peringatan
                            </h2>
                            <div className="grid gap-3">
                                {issues.filter(i => i.type === 'warning').map(issue => (
                                    <IssueCard key={issue.id} issue={issue} />
                                ))}
                            </div>
                        </section>
                    )}

                    {infoCount > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-500">
                                <Info className="w-4 h-4" /> Saran Perbaikan
                            </h2>
                            <div className="grid gap-3">
                                {issues.filter(i => i.type === 'info').map(issue => (
                                    <IssueCard key={issue.id} issue={issue} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="py-20 text-center border-2 border-dashed rounded-xl bg-muted/30">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 alpha-80" />
                    <h2 className="text-xl font-bold text-foreground">Data Sehat!</h2>
                    <p className="text-muted-foreground mt-2">
                        Tidak ditemukan masalah atau inkonsistensi pada data silsilah Anda.
                    </p>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingPersonId} onOpenChange={(open) => !open && setEditingPersonId(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display">Perbaiki Data</DialogTitle>
                    </DialogHeader>
                    <PersonForm
                        person={editingPerson}
                        onSuccess={() => setEditingPersonId(null)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
