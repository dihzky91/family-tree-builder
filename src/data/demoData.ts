import type { Person, Relationship } from '@/types';

/**
 * Demo family data - Keluarga Santoso (4 generations)
 * No database needed - all hardcoded for instant demo
 */

export const DEMO_PERSONS: Person[] = [
    // Generation 1 (Great Grandparents)
    {
        id: 'demo-gg-1',
        fullName: 'Raden Santoso',
        birthDate: '1930-03-15',
        deathDate: '2005-11-20',
        gender: 'male',
        birthPlace: 'Yogyakarta, Indonesia',
        deathPlace: 'Jakarta, Indonesia',
        notes: 'Kakek buyut, guru SD terkenal di Yogyakarta. Pekerjaan: Guru',
        tags: ['verified', 'founder'],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-gg-2',
        fullName: 'Siti Aminah',
        birthDate: '1932-07-22',
        deathDate: '2010-05-10',
        gender: 'female',
        birthPlace: 'Solo, Indonesia',
        notes: 'Nenek buyut, ahli memasak dan batik. Ibu Rumah Tangga',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-gg-3',
        fullName: 'Bapak Wirawan',
        birthDate: '1928-01-10',
        deathDate: '1998-12-15',
        gender: 'male',
        birthPlace: 'Bandung, Indonesia',
        notes: 'Pegawai Negeri',
        tags: [],
        photoUrl: '',
        confidenceScore: 85
    },
    {
        id: 'demo-gg-4',
        fullName: 'Ibu Sumarni',
        birthDate: '1935-09-05',
        deathDate: '2015-03-20',
        gender: 'female',
        birthPlace: 'Surabaya, Indonesia',
        notes: 'Pedagang',
        tags: [],
        photoUrl: '',
        confidenceScore: 85
    },

    // Generation 2 (Grandparents)
    {
        id: 'demo-g-1',
        fullName: 'Budi Santoso',
        birthDate: '1955-06-12',
        deathDate: '2020-08-15',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Kakek, dokter umum di RS Cipto Mangunkusumo',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-g-2',
        fullName: 'Sri Rahayu',
        birthDate: '1958-02-20',
        gender: 'female',
        birthPlace: 'Bandung, Indonesia',
        notes: 'Nenek, guru Bahasa Indonesia SMA',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-g-3',
        fullName: 'Ahmad Hidayat',
        birthDate: '1953-11-08',
        gender: 'male',
        birthPlace: 'Semarang, Indonesia',
        notes: 'Kakek dari pihak ibu, pengusaha',
        tags: [],
        photoUrl: '',
        confidenceScore: 90
    },
    {
        id: 'demo-g-4',
        fullName: 'Dewi Kusuma',
        birthDate: '1956-04-15',
        gender: 'female',
        birthPlace: 'Malang, Indonesia',
        notes: 'Desainer',
        tags: [],
        photoUrl: '',
        confidenceScore: 90
    },

    // Generation 3 (Parents)
    {
        id: 'demo-p-1',
        fullName: 'Andi Santoso',
        birthDate: '1980-03-25',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Ayah, bekerja sebagai Software Engineer di perusahaan teknologi',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-p-2',
        fullName: 'Maya Wijaya',
        birthDate: '1982-08-10',
        gender: 'female',
        birthPlace: 'Surabaya, Indonesia',
        notes: 'Ibu, Marketing Manager di perusahaan multinasional',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-p-3',
        fullName: 'Rudi Santoso',
        birthDate: '1978-12-05',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Paman, arsitek terkenal',
        tags: [],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-p-4',
        fullName: 'Sari Indah',
        birthDate: '1981-05-20',
        gender: 'female',
        birthPlace: 'Bandung, Indonesia',
        notes: 'Dokter Gigi',
        tags: [],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-p-5',
        fullName: 'Dian Pratiwi',
        birthDate: '1984-07-15',
        gender: 'female',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Bibi, psikolog anak',
        tags: [],
        photoUrl: '',
        confidenceScore: 90
    },

    // Generation 4 (Current - Children)
    {
        id: 'demo-c-1',
        fullName: 'Arif Santoso',
        birthDate: '2005-01-15',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Anak pertama, kuliah Teknik Informatika',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-c-2',
        fullName: 'Zahra Santoso',
        birthDate: '2008-06-20',
        gender: 'female',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Anak kedua, pelajar SMA aktif di organisasi sekolah',
        tags: ['verified'],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-c-3',
        fullName: 'Raffi Santoso',
        birthDate: '2012-11-10',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Anak ketiga, pelajar SMP suka olahraga basket',
        tags: [],
        photoUrl: '',
        confidenceScore: 100
    },
    {
        id: 'demo-c-4',
        fullName: 'Kevin Santoso',
        birthDate: '2006-03-12',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Sepupu, kuliah Desain Grafis',
        tags: [],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-c-5',
        fullName: 'Alya Santoso',
        birthDate: '2009-09-25',
        gender: 'female',
        birthPlace: 'Bandung, Indonesia',
        notes: 'Sepupu',
        tags: [],
        photoUrl: '',
        confidenceScore: 95
    },
    {
        id: 'demo-c-6',
        fullName: 'Farah Santoso',
        birthDate: '2010-12-08',
        gender: 'female',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Sepupu, pelajar SD hobi menggambar',
        tags: [],
        photoUrl: '',
        confidenceScore: 90
    },
    {
        id: 'demo-c-7',
        fullName: 'Rio Pratama',
        birthDate: '2007-04-18',
        gender: 'male',
        birthPlace: 'Jakarta, Indonesia',
        notes: 'Sepupu',
        tags: [],
        photoUrl: '',
        confidenceScore: 90
    }
];

export const DEMO_RELATIONSHIPS: Relationship[] = [
    // Gen 1 -> Gen 2
    { id: 'demo-rel-1', fromPersonId: 'demo-gg-1', toPersonId: 'demo-g-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-2', fromPersonId: 'demo-gg-2', toPersonId: 'demo-g-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-3', fromPersonId: 'demo-gg-3', toPersonId: 'demo-g-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-4', fromPersonId: 'demo-gg-4', toPersonId: 'demo-g-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-5', fromPersonId: 'demo-gg-1', toPersonId: 'demo-g-3', type: 'PARENT_CHILD' },
    { id: 'demo-rel-6', fromPersonId: 'demo-gg-2', toPersonId: 'demo-g-3', type: 'PARENT_CHILD' },

    // Gen 2 -> Gen 3
    { id: 'demo-rel-7', fromPersonId: 'demo-g-1', toPersonId: 'demo-p-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-8', fromPersonId: 'demo-g-2', toPersonId: 'demo-p-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-9', fromPersonId: 'demo-g-1', toPersonId: 'demo-p-3', type: 'PARENT_CHILD' },
    { id: 'demo-rel-10', fromPersonId: 'demo-g-2', toPersonId: 'demo-p-3', type: 'PARENT_CHILD' },
    { id: 'demo-rel-11', fromPersonId: 'demo-g-1', toPersonId: 'demo-p-5', type: 'PARENT_CHILD' },
    { id: 'demo-rel-12', fromPersonId: 'demo-g-2', toPersonId: 'demo-p-5', type: 'PARENT_CHILD' },
    { id: 'demo-rel-13', fromPersonId: 'demo-g-3', toPersonId: 'demo-p-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-14', fromPersonId: 'demo-g-4', toPersonId: 'demo-p-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-15', fromPersonId: 'demo-g-3', toPersonId: 'demo-p-4', type: 'PARENT_CHILD' },
    { id: 'demo-rel-16', fromPersonId: 'demo-g-4', toPersonId: 'demo-p-4', type: 'PARENT_CHILD' },

    // Gen 3 -> Gen 4
    { id: 'demo-rel-17', fromPersonId: 'demo-p-1', toPersonId: 'demo-c-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-18', fromPersonId: 'demo-p-2', toPersonId: 'demo-c-1', type: 'PARENT_CHILD' },
    { id: 'demo-rel-19', fromPersonId: 'demo-p-1', toPersonId: 'demo-c-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-20', fromPersonId: 'demo-p-2', toPersonId: 'demo-c-2', type: 'PARENT_CHILD' },
    { id: 'demo-rel-21', fromPersonId: 'demo-p-1', toPersonId: 'demo-c-3', type: 'PARENT_CHILD' },
    { id: 'demo-rel-22', fromPersonId: 'demo-p-2', toPersonId: 'demo-c-3', type: 'PARENT_CHILD' },
    { id: 'demo-rel-23', fromPersonId: 'demo-p-3', toPersonId: 'demo-c-4', type: 'PARENT_CHILD' },
    { id: 'demo-rel-24', fromPersonId: 'demo-p-4', toPersonId: 'demo-c-4', type: 'PARENT_CHILD' },
    { id: 'demo-rel-25', fromPersonId: 'demo-p-3', toPersonId: 'demo-c-5', type: 'PARENT_CHILD' },
    { id: 'demo-rel-26', fromPersonId: 'demo-p-4', toPersonId: 'demo-c-5', type: 'PARENT_CHILD' },
    { id: 'demo-rel-27', fromPersonId: 'demo-p-3', toPersonId: 'demo-c-6', type: 'PARENT_CHILD' },
    { id: 'demo-rel-28', fromPersonId: 'demo-p-4', toPersonId: 'demo-c-6', type: 'PARENT_CHILD' },
    { id: 'demo-rel-29', fromPersonId: 'demo-p-5', toPersonId: 'demo-c-7', type: 'PARENT_CHILD' },
];

/**
 * Load demo data into the store
 * This bypasses Supabase and uses hardcoded data
 */
export function getDemoData() {
    return {
        persons: DEMO_PERSONS,
        relationships: DEMO_RELATIONSHIPS
    };
}
