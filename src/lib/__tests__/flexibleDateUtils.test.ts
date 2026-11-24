import { describe, it, expect } from 'vitest';
import {
  parseFlexibleDate,
  serializeFlexibleDate,
  formatFlexibleDate,
  formatShortYearLabel,
  formatLifeSpan,
  getEstimatedYear,
  calculateFlexibleAge,
} from '@/lib/flexibleDateUtils';
import {
  getUpcomingBirthdays,
  getBirthdaysByMonth,
  getMonthOnlyBirthdays,
  getBirthdayStats,
} from '@/lib/birthdayUtils';
import {
  calculateAgeStats,
  calculateBirthStats,
} from '@/features/stats/utils/statsCalculations';
import type { Person } from '@/types';

const makePerson = (overrides: Partial<Person>): Person => ({
  id: '00000000-0000-0000-0000-000000000001',
  fullName: 'Eko Budiardi',
  gender: 'male',
  tags: [],
  confidenceScore: 80,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('flexibleDateUtils', () => {
  it('parses and formats exact full dates (backward compatible with YYYY-MM-DD)', () => {
    const parsed = parseFlexibleDate('1991-05-02');
    expect(parsed?.qualifier).toBe('exact');
    expect(parsed?.isExactFullDate).toBe(true);
    expect(parsed?.hasSpecificMonthDay).toBe(true);
    expect(parsed?.estimatedYear).toBe(1991);
    expect(formatFlexibleDate('1991-05-02')).toBe('2 Mei 1991');
    expect(formatShortYearLabel('1991-05-02')).toBe('1991');
  });

  it('parses and formats partial dates (year only, month+year, day+month)', () => {
    expect(formatFlexibleDate('1950')).toBe('1950');
    expect(parseFlexibleDate('1950')?.hasSpecificMonthDay).toBe(false);
    expect(parseFlexibleDate('1950')?.estimatedYear).toBe(1950);

    expect(formatFlexibleDate('1950-05')).toBe('Mei 1950');
    expect(parseFlexibleDate('1950-05')?.hasSpecificMonth).toBe(true);
    expect(parseFlexibleDate('1950-05')?.hasSpecificMonthDay).toBe(false);

    expect(formatFlexibleDate('--08-17')).toBe('17 Agustus');
    expect(parseFlexibleDate('--08-17')?.hasSpecificMonthDay).toBe(true);
    expect(parseFlexibleDate('--08-17')?.estimatedYear).toBeNull();
  });

  it('serializes and formats MyHeritage qualifiers (circa, before, after, unsure, between, from_to, free_text, unknown)', () => {
    const circa = serializeFlexibleDate({
      qualifier: 'circa',
      date1: { year: 1945, month: 8 },
    });
    expect(circa).toBe('ABT 1945-08');
    expect(formatFlexibleDate(circa)).toBe('Sekitar Agustus 1945');
    expect(formatShortYearLabel(circa)).toBe('~1945');

    const before = serializeFlexibleDate({
      qualifier: 'before',
      date1: { year: 1960 },
    });
    expect(before).toBe('BEF 1960');
    expect(formatFlexibleDate(before)).toBe('Sebelum 1960');
    expect(formatShortYearLabel(before)).toBe('<1960');

    const between = serializeFlexibleDate({
      qualifier: 'between',
      date1: { year: 1940 },
      date2: { year: 1946 },
    });
    expect(between).toBe('BET 1940 AND 1946');
    expect(formatFlexibleDate(between)).toBe('Antara 1940 dan 1946');
    expect(formatShortYearLabel(between)).toBe('1940–1946');
    expect(getEstimatedYear(between)).toBe(1943);

    const freeText = serializeFlexibleDate({
      qualifier: 'free_text',
      freeText: 'Masa Kemerdekaan',
    });
    expect(freeText).toBe('TEXT:Masa Kemerdekaan');
    expect(formatFlexibleDate(freeText)).toBe('Masa Kemerdekaan');

    const unknown = serializeFlexibleDate({ qualifier: 'unknown' });
    expect(unknown).toBe('UNKNOWN');
    expect(formatFlexibleDate(unknown)).toBe('Tanggal tidak diketahui');
    expect(formatLifeSpan('ABT 1940', 'UNKNOWN')).toBe('~1940 – ?');
  });

  it('calculates flexible age accurately', () => {
    const exactAge = calculateFlexibleAge('1980-01-01', '2020-06-01');
    expect(exactAge).toEqual({ age: 40, isApproximate: false });

    const approxAge = calculateFlexibleAge('ABT 1950', '2020-06-01');
    expect(approxAge).toEqual({ age: 70, isApproximate: true });

    const unknownDeathAge = calculateFlexibleAge('1950-01-01', 'UNKNOWN');
    expect(unknownDeathAge).toBeNull();
  });

  it('filters birthday calendar vs statistics according to date specificity', () => {
    const persons: Person[] = [
      makePerson({ id: '00000000-0000-0000-0000-000000000001', fullName: 'Exact Person', birthDate: '1991-05-02' }),
      makePerson({ id: '00000000-0000-0000-0000-000000000002', fullName: 'Month Only Person', birthDate: 'ABT 1950-05' }),
      makePerson({ id: '00000000-0000-0000-0000-000000000003', fullName: 'Year Only Person', birthDate: 'ABT 1945' }),
      makePerson({ id: '00000000-0000-0000-0000-000000000004', fullName: 'Free Text Person', birthDate: 'TEXT:Zaman Belanda' }),
    ];

    // Only Exact Person has month + day -> appears in upcoming birthdays and May calendar grid
    const upcoming = getUpcomingBirthdays(persons);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].person.fullName).toBe('Exact Person');

    const mayDays = getBirthdaysByMonth(persons, 4); // 4 = May (0-indexed)
    expect(mayDays).toHaveLength(1);
    expect(mayDays[0].day).toBe(2);

    // Month Only Person appears in month-only birthdays for May
    const mayMonthOnly = getMonthOnlyBirthdays(persons, 4);
    expect(mayMonthOnly).toHaveLength(1);
    expect(mayMonthOnly[0].fullName).toBe('Month Only Person');

    // Stats: both Exact Person & Month Only Person count toward May; 3 people have estimated years for averageAge
    const stats = getBirthdayStats(persons);
    expect(stats.mostCommonMonth).toBe('Mei');
    expect(stats.mostCommonMonthCount).toBe(2);
    expect(stats.totalWithBirthdays).toBe(1);
    expect(stats.totalWithEstimatedAge).toBe(3);

    // StatsPage birth & age stats:
    const birthStats = calculateBirthStats(persons);
    const mayStat = birthStats.monthDistribution.find((m) => m.month === 'Mei');
    expect(mayStat?.count).toBe(2);
    // Only Exact Person has a zodiac sign (month + day known)
    expect(birthStats.zodiacDistribution).toHaveLength(1);
    expect(birthStats.zodiacDistribution[0].sign).toBe('Taurus');
    // 3 persons have known/estimated decades (1990an, 1950an, 1940an)
    expect(birthStats.decadeDistribution).toHaveLength(3);

    const ageStats = calculateAgeStats(persons);
    expect(ageStats.oldestLiving[0].fullName).toBe('Year Only Person');
  });
});
