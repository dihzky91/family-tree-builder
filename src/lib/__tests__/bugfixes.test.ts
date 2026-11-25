import { describe, expect, it } from 'vitest';
import { generateGedcom } from '@/features/chart/utils/gedcomExport';
import { computeScopedShareData } from '@/storage/supabase/shareQueries';
import type { Person, Relationship } from '@/types';

const makePerson = (overrides: Partial<Person> & { id: string; fullName: string }): Person => ({
  gender: 'male',
  birthDate: null,
  deathDate: null,
  birthPlace: null,
  deathPlace: null,
  residence: null,
  photoUrl: null,
  notes: null,
  tags: [],
  confidenceScore: 80,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('Security & Data Bugfix Regressions', () => {
  it('masks birthPlace, residence street details, full birthDate, and notes for living members when hideLivingDetails is true', () => {
    const livingPerson = makePerson({
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'Andi Santoso',
      birthDate: '1992-08-17',
      birthPlace: 'RSUD Dr. Soetomo, Jl. Mayjen Prof. Dr. Moestopo No. 6, Surabaya',
      residence: 'Jl. Merdeka No. 10, RT 01/02, Bandung',
      notes: 'Nomor HP pribadi: 08123456789',
    });

    const deceasedPerson = makePerson({
      id: '22222222-2222-4222-8222-222222222222',
      fullName: 'Kakek Budi',
      birthDate: '1935-04-12',
      deathDate: '2010-11-01',
      birthPlace: 'Jl. Malioboro No. 5, Yogyakarta',
      notes: 'Pendiri keluarga',
    });

    const { persons } = computeScopedShareData([livingPerson, deceasedPerson], [], {
      scopeType: 'full',
      hideLivingDetails: true,
    });

    const maskedLiving = persons.find((p) => p.id === livingPerson.id)!;
    expect(maskedLiving.birthDate).toBe('1992');
    expect(maskedLiving.birthPlace).toBe('Surabaya');
    expect(maskedLiving.residence).toBe('Bandung');
    expect(maskedLiving.notes).toBeNull();

    const untouchedDeceased = persons.find((p) => p.id === deceasedPerson.id)!;
    expect(untouchedDeceased.birthDate).toBe('1935-04-12');
    expect(untouchedDeceased.notes).toBe('Pendiri keluarga');
  });

  it('exports GEDCOM with flexible dates, notes, and children of two parents without explicit SPOUSE link', () => {
    const father = makePerson({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      fullName: 'Hadi Wijaya',
      gender: 'male',
      birthDate: 'ABT 1950',
      notes: 'Catatan baris 1\nCatatan baris 2',
    });
    const mother = makePerson({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fullName: 'Siti Rahayu',
      gender: 'female',
      birthDate: 'BET 1952 AND 1955',
    });
    const child = makePerson({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      fullName: 'Rina Wijaya',
      gender: 'female',
      birthDate: '1980-05-02',
    });

    const relationships: Relationship[] = [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        type: 'PARENT_CHILD',
        fromPersonId: father.id,
        toPersonId: child.id,
        meta: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        type: 'PARENT_CHILD',
        fromPersonId: mother.id,
        toPersonId: child.id,
        meta: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const gedcom = generateGedcom([father, mother, child], relationships);

    expect(gedcom).toContain('2 DATE ABT 1950');
    expect(gedcom).toContain('2 DATE BET 1952 AND 1955');
    expect(gedcom).toContain('2 DATE 2 MAY 1980');
    expect(gedcom).toContain('1 NOTE Catatan baris 1');
    expect(gedcom).toContain('2 CONT Catatan baris 2');
    expect(gedcom).toContain('1 FAMC @F1@');
    expect(gedcom).toContain('1 CHIL @Icccccccccccc4ccc8ccc@');
  });
});
