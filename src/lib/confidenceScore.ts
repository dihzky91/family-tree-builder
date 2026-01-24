import { useFamilyStore } from '@/store/familyStore';
import type { Evidence, VerificationStatus } from '@/types';

interface ConfidenceAdjustment {
  delta: number;
  reason: string;
}

/**
 * Calculate confidence score adjustments based on evidence status changes
 */
export function calculateConfidenceAdjustment(
  oldStatus: VerificationStatus | null,
  newStatus: VerificationStatus
): ConfidenceAdjustment | null {
  // No change
  if (oldStatus === newStatus) return null;

  // Status change adjustments
  const statusValues: Record<VerificationStatus, number> = {
    verified: 20,
    under_review: 5,
    draft: 0,
    rejected: -10,
  };

  const oldValue = oldStatus ? statusValues[oldStatus] : 0;
  const newValue = statusValues[newStatus];
  const delta = newValue - oldValue;

  if (delta === 0) return null;

  const reasons: Record<VerificationStatus, string> = {
    verified: 'Dokumen diverifikasi',
    under_review: 'Dokumen dalam review',
    draft: 'Status dokumen diubah ke draft',
    rejected: 'Dokumen ditolak',
  };

  return {
    delta,
    reason: reasons[newStatus],
  };
}

/**
 * Get all evidence for a person and calculate suggested confidence adjustment
 */
export function getEvidenceBasedConfidence(
  personId: string,
  evidence: Evidence[]
): { score: number; breakdown: { status: VerificationStatus; count: number; contribution: number }[] } {
  const personEvidence = evidence.filter(
    e => e.entityType === 'PERSON' && e.entityId === personId
  );

  if (personEvidence.length === 0) {
    return { score: 0, breakdown: [] };
  }

  const statusCounts: Record<VerificationStatus, number> = {
    verified: 0,
    under_review: 0,
    draft: 0,
    rejected: 0,
  };

  personEvidence.forEach(e => {
    statusCounts[e.status]++;
  });

  const statusContributions: Record<VerificationStatus, number> = {
    verified: 20,
    under_review: 5,
    draft: 0,
    rejected: -10,
  };

  let totalScore = 0;
  const breakdown = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => {
      const contribution = statusContributions[status as VerificationStatus] * count;
      totalScore += contribution;
      return {
        status: status as VerificationStatus,
        count,
        contribution,
      };
    });

  // Cap the score contribution between -50 and +50
  totalScore = Math.max(-50, Math.min(50, totalScore));

  return { score: totalScore, breakdown };
}

/**
 * Recalculate and update a person's confidence score based on their evidence
 */
export async function recalculatePersonConfidence(
  personId: string,
  evidence: Evidence[],
  updatePerson: (id: string, updates: { confidenceScore: number }) => Promise<void>,
  currentScore: number
): Promise<number> {
  const { score: evidenceScore } = getEvidenceBasedConfidence(personId, evidence);
  
  // Base score (50) + evidence adjustments, capped between 0-100
  const baseScore = 50;
  const newScore = Math.max(0, Math.min(100, baseScore + evidenceScore));
  
  if (newScore !== currentScore) {
    await updatePerson(personId, { confidenceScore: newScore });
  }
  
  return newScore;
}
