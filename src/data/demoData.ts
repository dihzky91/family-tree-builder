import type { Person, Relationship, Branch, Submission, Story } from '@/types';

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

    // Spouses across generations (so Marriage Rings ⚭ and Spouse Connector lines render cleanly!)
    { id: 'demo-rel-30', fromPersonId: 'demo-gg-1', toPersonId: 'demo-gg-2', type: 'SPOUSE', meta: { status: 'married' } },
    { id: 'demo-rel-31', fromPersonId: 'demo-gg-3', toPersonId: 'demo-gg-4', type: 'SPOUSE', meta: { status: 'married' } },
    { id: 'demo-rel-32', fromPersonId: 'demo-g-1', toPersonId: 'demo-g-2', type: 'SPOUSE', meta: { status: 'married' } },
    { id: 'demo-rel-33', fromPersonId: 'demo-g-3', toPersonId: 'demo-g-4', type: 'SPOUSE', meta: { status: 'married' } },
    { id: 'demo-rel-34', fromPersonId: 'demo-p-1', toPersonId: 'demo-p-2', type: 'SPOUSE', meta: { status: 'married' } },
    { id: 'demo-rel-35', fromPersonId: 'demo-p-3', toPersonId: 'demo-p-4', type: 'SPOUSE', meta: { status: 'married' } },
];

export const DEMO_BRANCHES: Branch[] = [
    {
        id: 'demo-branch-1',
        code: 'trah-raden-santoso',
        name: 'Trah Utama Raden Santoso',
        rootPersonId: 'demo-gg-1',
        coordinatorName: 'Andi Santoso',
        coordinatorEmail: 'andi.santoso@familytree.local',
        description: 'Cabang induk seluruh keturunan Eyang Raden Santoso & Siti Aminah.',
        isActive: true,
        submissionCount: 4,
        approvedCount: 3,
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-03-15T10:00:00.000Z',
    },
    {
        id: 'demo-branch-2',
        code: 'keluarga-budi-santoso',
        name: 'Keluarga dr. Budi Santoso',
        rootPersonId: 'demo-g-1',
        coordinatorName: 'Andi Santoso',
        coordinatorEmail: 'andi.santoso@familytree.local',
        description: 'Khusus anak, menantu, dan cucu dari dr. Budi Santoso & Ibu Sri Rahayu.',
        isActive: true,
        submissionCount: 5,
        approvedCount: 3,
        createdAt: '2026-01-12T08:00:00.000Z',
        updatedAt: '2026-03-18T10:00:00.000Z',
    },
    {
        id: 'demo-branch-3',
        code: 'keluarga-andi-santoso',
        name: 'Keluarga Andi Santoso',
        rootPersonId: 'demo-p-1',
        coordinatorName: 'Arif Santoso',
        coordinatorEmail: 'arif.santoso@familytree.local',
        description: 'Keluarga inti Andi Santoso & Maya Wijaya.',
        isActive: true,
        submissionCount: 3,
        approvedCount: 3,
        createdAt: '2026-02-01T08:00:00.000Z',
        updatedAt: '2026-03-19T10:00:00.000Z',
    },
    {
        id: 'demo-branch-4',
        code: 'keluarga-rudi-santoso',
        name: 'Keluarga Arsitek Rudi Santoso',
        rootPersonId: 'demo-p-3',
        coordinatorName: 'Rudi Santoso',
        coordinatorEmail: 'rudi.santoso@familytree.local',
        description: 'Cabang keluarga Paman Rudi Santoso & drg. Sari Indah.',
        isActive: true,
        submissionCount: 4,
        approvedCount: 3,
        createdAt: '2026-02-05T08:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
    },
    {
        id: 'demo-branch-5',
        code: 'keluarga-dian-pratiwi',
        name: 'Keluarga Dian Pratiwi',
        rootPersonId: 'demo-p-5',
        coordinatorName: 'Dian Pratiwi',
        coordinatorEmail: 'dian.pratiwi@familytree.local',
        description: 'Cabang keluarga Bibi Dian Pratiwi.',
        isActive: true,
        submissionCount: 2,
        approvedCount: 1,
        createdAt: '2026-02-10T08:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
    },
];

export const DEMO_SUBMISSIONS: Submission[] = [
    {
        id: 'demo-sub-1',
        branchId: 'demo-branch-2',
        submittedBy: 'Dian Pratiwi',
        submitterEmail: 'dian.pratiwi@familytree.local',
        fullName: 'Hendra Pratama',
        gender: 'male',
        birthDate: '1982-09-14',
        birthPlace: 'Yogyakarta',
        residence: 'Jakarta',
        notes: 'Suami dari Dian Pratiwi, dosen Teknik Sipil',
        relationToBranch: 'other',
        parentName: 'Pasangan dari Dian Pratiwi',
        status: 'pending',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
        id: 'demo-sub-2',
        branchId: 'demo-branch-2',
        submittedBy: 'Dian Pratiwi',
        submitterEmail: 'dian.pratiwi@familytree.local',
        fullName: 'Nadia Pratama',
        gender: 'female',
        birthDate: '2011-05-22',
        birthPlace: 'Jakarta',
        residence: 'Jakarta',
        notes: 'Anak kedua dari Dian Pratiwi & Hendra Pratama',
        relationToBranch: 'grandchild',
        parentName: 'Dian Pratiwi',
        status: 'pending',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000 + 5000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000 + 5000).toISOString(),
    },
    {
        id: 'demo-sub-3',
        branchId: 'demo-branch-1',
        submittedBy: 'Rudi Santoso',
        submitterEmail: 'rudi.santoso@familytree.local',
        fullName: 'Raden Suryo Santoso',
        gender: 'male',
        birthDate: '1934-08-17',
        birthPlace: 'Yogyakarta',
        deathDate: '2012-04-09',
        deathPlace: 'Yogyakarta',
        notes: 'Adik kandung Eyang Raden Santoso yang menetap di Kotagede Yogyakarta',
        relationToBranch: 'other',
        parentName: 'Saudara kandung dari Raden Santoso',
        status: 'pending',
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
];

export const DEMO_STORIES: Story[] = [
    {
        id: 'demo-story-1',
        title: 'Perjalanan Eyang Raden Santoso Mengajar di Yogyakarta',
        content:
            'Pada tahun 1952, Eyang Raden Santoso memulai pengabdiannya sebagai guru sekolah rakyat di Yogyakarta. Beliau dikenal sangat disiplin namun hangat kepada murid-muridnya, sementara Eyang Putri Siti Aminah membuka usaha batik tulis rumahan yang menopang pendidikan anak-anaknya hingga menjadi dokter dan pengusaha.',
        authorId: null,
        personIds: ['demo-gg-1', 'demo-gg-2', 'demo-g-1'],
        date: '1952-07-01',
        tags: ['Sejarah Keluarga', 'Yogyakarta', 'Pendidikan'],
        createdAt: '2026-01-15T08:00:00.000Z',
        updatedAt: '2026-01-15T08:00:00.000Z',
    },
    {
        id: 'demo-story-2',
        title: 'Reuni Akbar Keluarga Besar Santoso 2025',
        content:
            'Pertemuan empat generasi Keluarga Besar Santoso yang dihadiri oleh cabang Jakarta, Bandung, Semarang, dan Yogyakarta. Momen bersejarah ketika para cucu dan cicit mendokumentasikan pohon silsilah keluarga secara digital.',
        authorId: null,
        personIds: ['demo-g-1', 'demo-g-2', 'demo-p-1', 'demo-p-3', 'demo-c-1'],
        date: '2025-12-24',
        tags: ['Reuni', 'Keluarga Besar'],
        createdAt: '2026-02-10T08:00:00.000Z',
        updatedAt: '2026-02-10T08:00:00.000Z',
    },
];

/**
 * Load demo data into the store
 * This bypasses Supabase and uses hardcoded data
 */
export function getDemoData() {
    return {
        persons: DEMO_PERSONS,
        relationships: DEMO_RELATIONSHIPS,
        branches: DEMO_BRANCHES,
        submissions: DEMO_SUBMISSIONS,
        stories: DEMO_STORIES,
    };
}
