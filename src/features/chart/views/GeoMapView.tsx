import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  Users,
  Search,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  AlertCircle,
  Loader2,
  Home,
  Baby,
  Cross,
  Layers,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Person } from '@/types';

interface GeoMapViewProps {
  persons: Person[];
  onSelectPerson?: (personId: string) => void;
}

type PlaceCategory = 'all' | 'birth' | 'residence' | 'death';

interface Coordinates {
  lat: number;
  lon: number;
  display_name: string;
}

interface PersonPlaceTag {
  person: Person;
  roles: Array<'birth' | 'residence' | 'death'>;
}

interface CityMarkerData {
  place: string;
  shortLabel: string;
  lat: number;
  lon: number;
  entries: PersonPlaceTag[];
  birthCount: number;
  residenceCount: number;
  deathCount: number;
}

/**
 * Offline Gazetteer for Indonesian cities, regencies, provinces & common diaspora hubs.
 * Enables 0ms instant rendering without waiting for 1.2s/req Nominatim rate limits.
 */
const INSTANT_GAZETTEER: Record<string, { lat: number; lon: number; label: string }> = {
  // DKI Jakarta & Jabodetabek
  jakarta: { lat: -6.2088, lon: 106.8456, label: 'Jakarta' },
  'dki jakarta': { lat: -6.2088, lon: 106.8456, label: 'DKI Jakarta' },
  'jakarta pusat': { lat: -6.1805, lon: 106.8284, label: 'Jakarta Pusat' },
  'jakarta selatan': { lat: -6.2615, lon: 106.8106, label: 'Jakarta Selatan' },
  'jakarta barat': { lat: -6.1674, lon: 106.7637, label: 'Jakarta Barat' },
  'jakarta timur': { lat: -6.225, lon: 106.9004, label: 'Jakarta Timur' },
  'jakarta utara': { lat: -6.1384, lon: 106.8639, label: 'Jakarta Utara' },
  bogor: { lat: -6.5971, lon: 106.806, label: 'Bogor' },
  depok: { lat: -6.4025, lon: 106.7942, label: 'Depok' },
  tangerang: { lat: -6.1783, lon: 106.6319, label: 'Tangerang' },
  'tangerang selatan': { lat: -6.2886, lon: 106.7179, label: 'Tangerang Selatan' },
  tangsel: { lat: -6.2886, lon: 106.7179, label: 'Tangerang Selatan' },
  bekasi: { lat: -6.2383, lon: 106.9756, label: 'Bekasi' },

  // Banten & Jawa Barat
  serang: { lat: -6.1104, lon: 106.163, label: 'Serang' },
  cilegon: { lat: -6.0025, lon: 106.0111, label: 'Cilegon' },
  pandeglang: { lat: -6.3086, lon: 106.1067, label: 'Pandeglang' },
  lebak: { lat: -6.5644, lon: 106.2522, label: 'Lebak' },
  rangkasbitung: { lat: -6.3597, lon: 106.2494, label: 'Rangkasbitung' },
  bandung: { lat: -6.9175, lon: 107.6191, label: 'Bandung' },
  cimahi: { lat: -6.8722, lon: 107.5425, label: 'Cimahi' },
  cirebon: { lat: -6.732, lon: 108.5523, label: 'Cirebon' },
  tasikmalaya: { lat: -7.3274, lon: 108.2207, label: 'Tasikmalaya' },
  garut: { lat: -7.2279, lon: 107.9087, label: 'Garut' },
  sukabumi: { lat: -6.9277, lon: 106.93, label: 'Sukabumi' },
  cianjur: { lat: -6.8168, lon: 107.1425, label: 'Cianjur' },
  karawang: { lat: -6.3227, lon: 107.3376, label: 'Karawang' },
  purwakarta: { lat: -6.5569, lon: 107.4433, label: 'Purwakarta' },
  subang: { lat: -6.5715, lon: 107.7587, label: 'Subang' },
  sumedang: { lat: -6.8586, lon: 107.9204, label: 'Sumedang' },
  indramayu: { lat: -6.3276, lon: 108.3249, label: 'Indramayu' },
  majalengka: { lat: -6.8364, lon: 108.2279, label: 'Majalengka' },
  kuningan: { lat: -6.9761, lon: 108.4831, label: 'Kuningan' },
  ciamis: { lat: -7.3257, lon: 108.3534, label: 'Ciamis' },
  banjar: { lat: -7.3706, lon: 108.5342, label: 'Banjar' },
  pangandaran: { lat: -7.6849, lon: 108.6512, label: 'Pangandaran' },

  // Jawa Tengah & DIY
  semarang: { lat: -6.9667, lon: 110.4167, label: 'Semarang' },
  surakarta: { lat: -7.5755, lon: 110.8243, label: 'Surakarta (Solo)' },
  solo: { lat: -7.5755, lon: 110.8243, label: 'Surakarta (Solo)' },
  yogyakarta: { lat: -7.7956, lon: 110.3695, label: 'Yogyakarta' },
  jogja: { lat: -7.7956, lon: 110.3695, label: 'Yogyakarta' },
  yogya: { lat: -7.7956, lon: 110.3695, label: 'Yogyakarta' },
  sleman: { lat: -7.7162, lon: 110.3556, label: 'Sleman' },
  bantul: { lat: -7.8878, lon: 110.3289, label: 'Bantul' },
  gunungkidul: { lat: -7.9644, lon: 110.6019, label: 'Gunungkidul' },
  'kulon progo': { lat: -7.8569, lon: 110.1647, label: 'Kulon Progo' },
  magelang: { lat: -7.4797, lon: 110.2177, label: 'Magelang' },
  salatiga: { lat: -7.3305, lon: 110.5084, label: 'Salatiga' },
  pekalongan: { lat: -6.8886, lon: 109.6753, label: 'Pekalongan' },
  tegal: { lat: -6.8694, lon: 109.1402, label: 'Tegal' },
  brebes: { lat: -6.8706, lon: 109.0422, label: 'Brebes' },
  pemalang: { lat: -6.8906, lon: 109.3808, label: 'Pemalang' },
  batang: { lat: -6.9081, lon: 109.7303, label: 'Batang' },
  kendal: { lat: -6.9267, lon: 110.2039, label: 'Kendal' },
  demak: { lat: -6.8944, lon: 110.6386, label: 'Demak' },
  kudus: { lat: -6.8048, lon: 110.8405, label: 'Kudus' },
  jepara: { lat: -6.5889, lon: 110.6683, label: 'Jepara' },
  pati: { lat: -6.7559, lon: 111.038, label: 'Pati' },
  rembang: { lat: -6.7086, lon: 111.3414, label: 'Rembang' },
  blora: { lat: -6.9697, lon: 111.4186, label: 'Blora' },
  grobogan: { lat: -7.0872, lon: 110.9158, label: 'Grobogan' },
  purwodadi: { lat: -7.0872, lon: 110.9158, label: 'Purwodadi' },
  cilacap: { lat: -7.7279, lon: 109.0079, label: 'Cilacap' },
  purwokerto: { lat: -7.4244, lon: 109.2302, label: 'Purwokerto' },
  banyumas: { lat: -7.5142, lon: 109.2942, label: 'Banyumas' },
  purbalingga: { lat: -7.3881, lon: 109.3639, label: 'Purbalingga' },
  banjarnegara: { lat: -7.3978, lon: 109.6989, label: 'Banjarnegara' },
  kebumen: { lat: -7.6681, lon: 109.6519, label: 'Kebumen' },
  purworejo: { lat: -7.7142, lon: 110.0081, label: 'Purworejo' },
  wonosobo: { lat: -7.3614, lon: 109.9003, label: 'Wonosobo' },
  temanggung: { lat: -7.3161, lon: 110.1753, label: 'Temanggung' },
  klaten: { lat: -7.7058, lon: 110.6064, label: 'Klaten' },
  boyolali: { lat: -7.5322, lon: 110.5956, label: 'Boyolali' },
  sukoharjo: { lat: -7.6828, lon: 110.8414, label: 'Sukoharjo' },
  karanganyar: { lat: -7.5961, lon: 110.9508, label: 'Karanganyar' },
  sragen: { lat: -7.4264, lon: 111.0219, label: 'Sragen' },
  wonogiri: { lat: -7.8147, lon: 110.9258, label: 'Wonogiri' },

  // Jawa Timur
  surabaya: { lat: -7.2575, lon: 112.7521, label: 'Surabaya' },
  malang: { lat: -7.9666, lon: 112.6326, label: 'Malang' },
  batu: { lat: -7.8671, lon: 112.5239, label: 'Batu' },
  sidoarjo: { lat: -7.4478, lon: 112.7183, label: 'Sidoarjo' },
  gresik: { lat: -7.1566, lon: 112.6555, label: 'Gresik' },
  mojokerto: { lat: -7.4726, lon: 112.4341, label: 'Mojokerto' },
  pasuruan: { lat: -7.6453, lon: 112.9075, label: 'Pasuruan' },
  probolinggo: { lat: -7.7543, lon: 113.2159, label: 'Probolinggo' },
  jember: { lat: -8.1724, lon: 113.6995, label: 'Jember' },
  banyuwangi: { lat: -8.2192, lon: 114.3691, label: 'Banyuwangi' },
  lumajang: { lat: -8.1339, lon: 113.2242, label: 'Lumajang' },
  bondowoso: { lat: -7.9135, lon: 113.8214, label: 'Bondowoso' },
  situbondo: { lat: -7.7062, lon: 114.0098, label: 'Situbondo' },
  kediri: { lat: -7.8166, lon: 112.0114, label: 'Kediri' },
  blitar: { lat: -8.0955, lon: 112.1609, label: 'Blitar' },
  tulungagung: { lat: -8.0657, lon: 111.9025, label: 'Tulungagung' },
  trenggalek: { lat: -8.05, lon: 111.7167, label: 'Trenggalek' },
  nganjuk: { lat: -7.605, lon: 111.9039, label: 'Nganjuk' },
  jombang: { lat: -7.546, lon: 112.2331, label: 'Jombang' },
  madiun: { lat: -7.6298, lon: 111.5239, label: 'Madiun' },
  ngawi: { lat: -7.4039, lon: 111.4461, label: 'Ngawi' },
  magetan: { lat: -7.6494, lon: 111.3381, label: 'Magetan' },
  ponorogo: { lat: -7.8686, lon: 111.4619, label: 'Ponorogo' },
  pacitan: { lat: -8.1956, lon: 111.1058, label: 'Pacitan' },
  bojonegoro: { lat: -7.1502, lon: 111.8817, label: 'Bojonegoro' },
  tuban: { lat: -6.8976, lon: 112.0649, label: 'Tuban' },
  lamongan: { lat: -7.1194, lon: 112.4167, label: 'Lamongan' },
  bangkalan: { lat: -7.0455, lon: 112.7351, label: 'Bangkalan' },
  sampang: { lat: -7.1872, lon: 113.2394, label: 'Sampang' },
  pamekasan: { lat: -7.1568, lon: 113.4746, label: 'Pamekasan' },
  sumenep: { lat: -7.0167, lon: 113.8667, label: 'Sumenep' },
  madura: { lat: -7.0833, lon: 113.25, label: 'Madura' },

  // Sumatera
  banda: { lat: 5.5483, lon: 95.3238, label: 'Banda Aceh' },
  'banda aceh': { lat: 5.5483, lon: 95.3238, label: 'Banda Aceh' },
  aceh: { lat: 5.5483, lon: 95.3238, label: 'Aceh' },
  lhokseumawe: { lat: 5.1801, lon: 97.1507, label: 'Lhokseumawe' },
  langsa: { lat: 4.4683, lon: 97.9683, label: 'Langsa' },
  medan: { lat: 3.5952, lon: 98.6722, label: 'Medan' },
  binjai: { lat: 3.6001, lon: 98.4854, label: 'Binjai' },
  pematangsiantar: { lat: 2.9595, lon: 99.0682, label: 'Pematangsiantar' },
  'tebing tinggi': { lat: 3.3285, lon: 99.1625, label: 'Tebing Tinggi' },
  sibolga: { lat: 1.7427, lon: 98.7792, label: 'Sibolga' },
  padangsidempuan: { lat: 1.3789, lon: 99.2717, label: 'Padangsidempuan' },
  padang: { lat: -0.9471, lon: 100.4172, label: 'Padang' },
  bukittinggi: { lat: -0.3056, lon: 100.3692, label: 'Bukittinggi' },
  payakumbuh: { lat: -0.2202, lon: 100.6308, label: 'Payakumbuh' },
  pariaman: { lat: -0.6264, lon: 100.1206, label: 'Pariaman' },
  solok: { lat: -0.7968, lon: 100.6563, label: 'Solok' },
  padangpanjang: { lat: -0.4628, lon: 100.4022, label: 'Padang Panjang' },
  'padang panjang': { lat: -0.4628, lon: 100.4022, label: 'Padang Panjang' },
  batusangkar: { lat: -0.4556, lon: 100.5928, label: 'Batusangkar' },
  pekanbaru: { lat: 0.5071, lon: 101.4478, label: 'Pekanbaru' },
  riau: { lat: 0.5071, lon: 101.4478, label: 'Riau' },
  dumai: { lat: 1.6675, lon: 101.4478, label: 'Dumai' },
  batam: { lat: 1.0456, lon: 104.0305, label: 'Batam' },
  tanjungpinang: { lat: 0.9186, lon: 104.4467, label: 'Tanjungpinang' },
  jambi: { lat: -1.6101, lon: 103.6131, label: 'Jambi' },
  palembang: { lat: -2.9761, lon: 104.7754, label: 'Palembang' },
  prabumulih: { lat: -3.4328, lon: 104.2356, label: 'Prabumulih' },
  lubuklinggau: { lat: -3.2967, lon: 102.8614, label: 'Lubuklinggau' },
  pangkalpinang: { lat: -2.1316, lon: 106.1169, label: 'Pangkalpinang' },
  bangka: { lat: -2.1316, lon: 106.1169, label: 'Bangka' },
  belitung: { lat: -2.7411, lon: 107.6548, label: 'Belitung' },
  tanjungpandan: { lat: -2.7411, lon: 107.6548, label: 'Tanjungpandan (Belitung)' },
  bengkulu: { lat: -3.7928, lon: 102.2608, label: 'Bengkulu' },
  'bandar lampung': { lat: -5.3971, lon: 105.2668, label: 'Bandar Lampung' },
  lampung: { lat: -5.3971, lon: 105.2668, label: 'Lampung' },
  metro: { lat: -5.1131, lon: 105.3067, label: 'Metro' },

  // Kalimantan
  pontianak: { lat: -0.0263, lon: 109.3425, label: 'Pontianak' },
  singkawang: { lat: 0.9063, lon: 108.9872, label: 'Singkawang' },
  palangkaraya: { lat: -2.2136, lon: 113.9108, label: 'Palangka Raya' },
  'palangka raya': { lat: -2.2136, lon: 113.9108, label: 'Palangka Raya' },
  banjarmasin: { lat: -3.3186, lon: 114.5944, label: 'Banjarmasin' },
  banjarbaru: { lat: -3.4422, lon: 114.8325, label: 'Banjarbaru' },
  martapura: { lat: -3.4119, lon: 114.8489, label: 'Martapura' },
  balikpapan: { lat: -1.2379, lon: 116.8529, label: 'Balikpapan' },
  samarinda: { lat: -0.5022, lon: 117.1536, label: 'Samarinda' },
  bontang: { lat: 0.1333, lon: 117.5, label: 'Bontang' },
  tenggarong: { lat: -0.4158, lon: 116.9889, label: 'Tenggarong' },
  tarakan: { lat: 3.3, lon: 117.6333, label: 'Tarakan' },

  // Bali & Nusa Tenggara
  denpasar: { lat: -8.6705, lon: 115.2126, label: 'Denpasar' },
  bali: { lat: -8.6705, lon: 115.2126, label: 'Bali' },
  badung: { lat: -8.5819, lon: 115.1772, label: 'Badung' },
  gianyar: { lat: -8.5447, lon: 115.3253, label: 'Gianyar' },
  ubud: { lat: -8.5069, lon: 115.2625, label: 'Ubud' },
  singaraja: { lat: -8.112, lon: 115.0882, label: 'Singaraja' },
  mataram: { lat: -8.5833, lon: 116.1167, label: 'Mataram' },
  lombok: { lat: -8.5833, lon: 116.1167, label: 'Lombok' },
  bima: { lat: -8.4606, lon: 118.7267, label: 'Bima' },
  kupang: { lat: -10.1772, lon: 123.607, label: 'Kupang' },

  // Sulawesi, Maluku & Papua
  makassar: { lat: -5.1477, lon: 119.4327, label: 'Makassar' },
  'ujung pandang': { lat: -5.1477, lon: 119.4327, label: 'Makassar' },
  parepare: { lat: -4.0135, lon: 119.6255, label: 'Parepare' },
  palopo: { lat: -2.9925, lon: 120.1969, label: 'Palopo' },
  gowa: { lat: -5.2067, lon: 119.4533, label: 'Gowa' },
  manado: { lat: 1.4748, lon: 124.8421, label: 'Manado' },
  bitung: { lat: 1.4451, lon: 125.1824, label: 'Bitung' },
  tomohon: { lat: 1.3235, lon: 124.8394, label: 'Tomohon' },
  palu: { lat: -0.8917, lon: 119.8707, label: 'Palu' },
  kendari: { lat: -3.9985, lon: 122.5129, label: 'Kendari' },
  baubau: { lat: -5.4633, lon: 122.6022, label: 'Baubau' },
  gorontalo: { lat: 0.5435, lon: 123.0568, label: 'Gorontalo' },
  mamuju: { lat: -2.6778, lon: 118.8878, label: 'Mamuju' },
  ambon: { lat: -3.6954, lon: 128.1814, label: 'Ambon' },
  ternate: { lat: 0.7893, lon: 127.3774, label: 'Ternate' },
  jayapura: { lat: -2.5337, lon: 140.7181, label: 'Jayapura' },
  sorong: { lat: -0.8762, lon: 131.2558, label: 'Sorong' },
  manokwari: { lat: -0.8615, lon: 134.062, label: 'Manokwari' },
  merauke: { lat: -8.4932, lon: 140.4018, label: 'Merauke' },

  // Regional / International
  singapore: { lat: 1.3521, lon: 103.8198, label: 'Singapura' },
  singapura: { lat: 1.3521, lon: 103.8198, label: 'Singapura' },
  'kuala lumpur': { lat: 3.139, lon: 101.6869, label: 'Kuala Lumpur' },
  malaysia: { lat: 3.139, lon: 101.6869, label: 'Malaysia' },
  penang: { lat: 5.4141, lon: 100.3288, label: 'Penang' },
  melaka: { lat: 2.1896, lon: 102.2501, label: 'Melaka' },
};

const PLACE_ALIASES: Record<string, string> = {
  jkt: 'Jakarta',
  jakarta: 'Jakarta',
  'dki jakarta': 'Jakarta',
  jaksel: 'Jakarta Selatan',
  jakpus: 'Jakarta Pusat',
  jakbar: 'Jakarta Barat',
  jaktim: 'Jakarta Timur',
  jakut: 'Jakarta Utara',
  jogja: 'Yogyakarta',
  yogya: 'Yogyakarta',
  diy: 'Yogyakarta',
  solo: 'Surakarta',
  sby: 'Surabaya',
  bdg: 'Bandung',
  smg: 'Semarang',
  mlg: 'Malang',
  mdn: 'Medan',
  pdg: 'Padang',
  plg: 'Palembang',
  pku: 'Pekanbaru',
  bpp: 'Balikpapan',
  smd: 'Samarinda',
  mks: 'Makassar',
  dps: 'Denpasar',
  bjm: 'Banjarmasin',
  ptk: 'Pontianak',
};

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizePlace(rawPlace?: string | null): string | null {
  if (!rawPlace) return null;

  const collapsed = rawPlace
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;]+$/g, '');

  if (collapsed.length < 2) return null;

  const lowered = collapsed.toLowerCase();
  if (PLACE_ALIASES[lowered]) {
    return `${PLACE_ALIASES[lowered]}, Indonesia`;
  }

  // Also check if the first segment before comma is an alias or in gazetteer
  const rawSegments = collapsed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSegments.length === 0) return null;

  const firstLower = rawSegments[0].toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/i, '');
  if (PLACE_ALIASES[firstLower]) {
    return `${PLACE_ALIASES[firstLower]}, Indonesia`;
  }
  if (INSTANT_GAZETTEER[firstLower]) {
    return `${INSTANT_GAZETTEER[firstLower].label}, Indonesia`;
  }

  const parts = rawSegments.map((part) => toTitleCase(part.toLowerCase()));
  if (parts.length === 1 && !/indonesia/i.test(parts[0])) {
    parts.push('Indonesia');
  }

  return parts.join(', ');
}

function resolveInstantCoordinates(normalizedPlace: string): Coordinates | null {
  const segments = normalizedPlace
    .split(',')
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^(kota|kab\.?|kabupaten|provinsi)\s+/i, '')
    )
    .filter(Boolean);

  for (const seg of segments) {
    if (seg === 'indonesia') continue;
    const aliasTarget = PLACE_ALIASES[seg]?.toLowerCase();
    if (aliasTarget && INSTANT_GAZETTEER[aliasTarget]) {
      const hit = INSTANT_GAZETTEER[aliasTarget];
      return { lat: hit.lat, lon: hit.lon, display_name: `${hit.label}, Indonesia` };
    }
    if (INSTANT_GAZETTEER[seg]) {
      const hit = INSTANT_GAZETTEER[seg];
      return { lat: hit.lat, lon: hit.lon, display_name: `${hit.label}, Indonesia` };
    }
  }
  return null;
}

const CACHE_KEY = 'geo_cache_v2';
const getCache = (): Record<string, Coordinates> => {
  try {
    const v2 = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const v1 = JSON.parse(localStorage.getItem('geo_cache_v1') || '{}');
    return { ...v1, ...v2 };
  } catch {
    return {};
  }
};

const saveCache = (cache: Record<string, Coordinates>) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage quota errors
  }
};

/**
 * Create a clean, modern numbered pin badge using Leaflet DivIcon
 */
function createClusterBadgeIcon(count: number, isActive: boolean) {
  const size = count >= 10 ? 40 : count >= 4 ? 36 : 32;
  const bg = isActive
    ? 'background: linear-gradient(135deg, #d97706, #b45309); ring: 4px;'
    : count >= 5
      ? 'background: linear-gradient(135deg, #059669, #047857);'
      : 'background: linear-gradient(135deg, #0284c7, #0369a1);';

  const border = isActive ? '3px solid #fef3c7' : '2.5px solid #ffffff';
  const shadow = isActive
    ? '0 0 0 5px rgba(217,119,6,0.32), 0 8px 18px rgba(15,23,42,0.4)'
    : '0 4px 12px rgba(15,23,42,0.32)';

  return L.divIcon({
    className: 'custom-family-map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      ${bg}
      border:${border};
      box-shadow:${shadow};
      color:#ffffff;
      font-weight:700;
      font-size:${count >= 10 ? '13px' : '12px'};
      display:flex;
      align-items:center;
      justify-content:center;
      transition:transform 0.18s ease;
    ">${count}</div>`,
  });
}

function MapController({
  markers,
  fitTrigger,
  flyTarget,
}: {
  markers: CityMarkerData[];
  fitTrigger: number;
  flyTarget: { lat: number; lon: number; ts: number } | null;
}) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);

  // Observe container resize so Leaflet canvas never glitches or clips
  useEffect(() => {
    const container = map.getContainer();
    const timer = window.setTimeout(() => map.invalidateSize(), 100);
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  // Fit bounds ONCE when markers first arrive or when user explicitly clicks "Fit Semua"
  useEffect(() => {
    if (markers.length === 0) return;
    if (hasInitialFitRef.current && fitTrigger === 0) return;

    hasInitialFitRef.current = true;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lon], 8, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(
      markers.map((marker) => [marker.lat, marker.lon] as [number, number])
    );
    map.fitBounds(bounds, { padding: [44, 44], maxZoom: 8, animate: fitTrigger > 0 });
  }, [map, markers, fitTrigger]);

  // Smooth flyTo when user clicks a city in the directory sidebar
  useEffect(() => {
    if (!flyTarget) return;
    map.flyTo([flyTarget.lat, flyTarget.lon], 10, { duration: 0.75 });
  }, [map, flyTarget]);

  return null;
}

export function GeoMapView({ persons, onSelectPerson }: GeoMapViewProps) {
  const [category, setCategory] = useState<PlaceCategory>('all');
  const [citySearch, setCitySearch] = useState('');
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [fitTrigger, setFitTrigger] = useState(0);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; ts: number } | null>(null);

  const [remoteLocations, setRemoteLocations] = useState<Record<string, Coordinates>>(() =>
    getCache()
  );
  const [loadingRemoteCount, setLoadingRemoteCount] = useState(0);

  // Collect all place entries per person according to selected category
  const placeGroups = useMemo(() => {
    const byPlace = new Map<
      string,
      {
        rawSample: string;
        peopleMap: Map<string, PersonPlaceTag>;
        birthCount: number;
        residenceCount: number;
        deathCount: number;
      }
    >();

    const registerPlace = (
      raw: string | null | undefined,
      person: Person,
      role: 'birth' | 'residence' | 'death'
    ) => {
      const normalized = normalizePlace(raw);
      if (!normalized || !raw) return;

      if (!byPlace.has(normalized)) {
        byPlace.set(normalized, {
          rawSample: raw.trim(),
          peopleMap: new Map(),
          birthCount: 0,
          residenceCount: 0,
          deathCount: 0,
        });
      }
      const group = byPlace.get(normalized)!;
      if (role === 'birth') group.birthCount++;
      if (role === 'residence') group.residenceCount++;
      if (role === 'death') group.deathCount++;

      const existing = group.peopleMap.get(person.id);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
      } else {
        group.peopleMap.set(person.id, { person, roles: [role] });
      }
    };

    persons.forEach((p) => {
      if (category === 'all' || category === 'birth') {
        registerPlace(p.birthPlace, p, 'birth');
      }
      if (category === 'all' || category === 'residence') {
        registerPlace(p.residence, p, 'residence');
      }
      if (category === 'all' || category === 'death') {
        registerPlace(p.deathPlace, p, 'death');
      }
    });

    return byPlace;
  }, [persons, category]);

  // Resolve coordinates: 1) Instant Gazetteer (0ms), 2) LocalStorage Cache (0ms), 3) Nominatim fallback (batched)
  const { resolvedMap, unknownPlaces } = useMemo(() => {
    const resolved: Record<string, Coordinates> = {};
    const unknowns: string[] = [];

    placeGroups.forEach((_, placeName) => {
      const instant = resolveInstantCoordinates(placeName);
      if (instant) {
        resolved[placeName] = instant;
        return;
      }
      const key = placeName.toLowerCase();
      if (remoteLocations[key]) {
        resolved[placeName] = remoteLocations[key];
        return;
      }
      unknowns.push(placeName);
    });

    return { resolvedMap: resolved, unknownPlaces: unknowns };
  }, [placeGroups, remoteLocations]);

  // Background geocoding ONLY for unknown places not in the instant gazetteer, batched once at the end
  useEffect(() => {
    if (unknownPlaces.length === 0) {
      setLoadingRemoteCount(0);
      return;
    }

    let cancelled = false;

    const fetchUnknowns = async () => {
      setLoadingRemoteCount(unknownPlaces.length);
      const cache = getCache();
      const fetchedBatch: Record<string, Coordinates> = {};
      let hasUpdates = false;

      for (const place of unknownPlaces) {
        if (cancelled) break;
        const key = place.toLowerCase();
        if (cache[key]) {
          fetchedBatch[key] = cache[key];
          continue;
        }

        try {
          await new Promise((r) => setTimeout(r, 1100));
          if (cancelled) break;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`
          );
          const data = await res.json();
          if (data && data.length > 0) {
            const loc: Coordinates = {
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon),
              display_name: data[0].display_name,
            };
            cache[key] = loc;
            fetchedBatch[key] = loc;
            hasUpdates = true;
          }
        } catch {
          // ignore network errors
        }
      }

      if (!cancelled) {
        if (hasUpdates) {
          saveCache(cache);
          // Batch update state ONCE to avoid repeated fitBounds lag
          setRemoteLocations((prev) => ({ ...prev, ...fetchedBatch }));
        }
        setLoadingRemoteCount(0);
      }
    };

    void fetchUnknowns();
    return () => {
      cancelled = true;
    };
  }, [unknownPlaces]);

  // Build final sorted markers list
  const markers = useMemo<CityMarkerData[]>(() => {
    const list: CityMarkerData[] = [];

    placeGroups.forEach((group, placeName) => {
      const coords = resolvedMap[placeName];
      if (!coords) return;

      const entries = Array.from(group.peopleMap.values());
      if (entries.length === 0) return;

      const shortLabel = placeName.replace(/,\s*Indonesia$/i, '');
      list.push({
        place: placeName,
        shortLabel,
        lat: coords.lat,
        lon: coords.lon,
        entries,
        birthCount: group.birthCount,
        residenceCount: group.residenceCount,
        deathCount: group.deathCount,
      });
    });

    return list.sort((a, b) => b.entries.length - a.entries.length);
  }, [placeGroups, resolvedMap]);

  const filteredMarkers = useMemo(() => {
    if (!citySearch.trim()) return markers;
    const q = citySearch.toLowerCase();
    return markers.filter(
      (m) =>
        m.shortLabel.toLowerCase().includes(q) ||
        m.entries.some((e) => e.person.fullName.toLowerCase().includes(q))
    );
  }, [markers, citySearch]);

  const mappedPersonsCount = useMemo(() => {
    const ids = new Set<string>();
    markers.forEach((m) => m.entries.forEach((e) => ids.add(e.person.id)));
    return ids.size;
  }, [markers]);

  const handleSelectCity = useCallback((m: CityMarkerData) => {
    setActivePlace(m.place);
    setFlyTarget({ lat: m.lat, lon: m.lon, ts: Date.now() });
  }, []);

  const handleFitAll = useCallback(() => {
    setActivePlace(null);
    setFitTrigger((n) => n + 1);
  }, []);

  const selectedCityData = useMemo(
    () => markers.find((m) => m.place === activePlace) || null,
    [markers, activePlace]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Compact Top Control Bar (Never pushes map off-screen) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/90 px-3 sm:px-4 py-2 backdrop-blur-sm shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-background/90"
            onClick={() => setShowSidebar((prev) => !prev)}
            title={showSidebar ? 'Sembunyikan daftar kota' : 'Tampilkan daftar kota'}
          >
            {showSidebar ? (
              <PanelLeftClose className="h-3.5 w-3.5 text-primary" />
            ) : (
              <PanelLeftOpen className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Daftar Lokasi ({markers.length})</span>
          </Button>

          {/* Filter by Location Type */}
          <Select value={category} onValueChange={(v) => setCategory(v as PlaceCategory)}>
            <SelectTrigger className="h-8 w-[170px] bg-background/90 text-xs">
              <Layers className="mr-1.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Semua Lokasi (Lahir & Domisili)
              </SelectItem>
              <SelectItem value="birth" className="text-xs">
                Tempat Kelahiran Saja
              </SelectItem>
              <SelectItem value="residence" className="text-xs">
                Domisili Saat Ini Saja
              </SelectItem>
              <SelectItem value="death" className="text-xs">
                Tempat Wafat Saja
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-background/90"
            onClick={handleFitAll}
            disabled={markers.length === 0}
            title="Reset kamera peta agar seluruh lokasi terlihat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tampilkan Semua</span>
          </Button>
        </div>

        {/* Summary Badges */}
        <div className="flex items-center gap-1.5">
          {loadingRemoteCount > 0 && (
            <Badge variant="outline" className="gap-1.5 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Mencari {loadingRemoteCount} lokasi...
            </Badge>
          )}
          <Badge variant="secondary" className="text-[11px] gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            {markers.length} kota · {mappedPersonsCount}/{persons.length} anggota
          </Badge>
          {unknownPlaces.length > 0 && loadingRemoteCount === 0 && (
            <Badge
              variant="outline"
              className="hidden md:inline-flex gap-1 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-300"
              title={`Lokasi belum dikenali: ${unknownPlaces.join(', ')}`}
            >
              <AlertCircle className="h-3 w-3" />
              {unknownPlaces.length} belum spesifik
            </Badge>
          )}
        </div>
      </div>

      {/* Main Split Body: Collapsible City Directory + Full-Height Interactive Map */}
      <div className="relative flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left/Collapsible City & Member Directory (Overlay on mobile, docked on desktop) */}
        {showSidebar && (
          <aside className="absolute inset-y-0 left-0 z-[500] flex w-64 sm:w-72 shrink-0 flex-col border-r bg-card/95 shadow-xl sm:relative sm:z-20 sm:shadow-none backdrop-blur-sm">
            <div className="p-2.5 border-b space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari kota atau nama..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Selected City Drilldown OR All Cities List */}
            {selectedCityData ? (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex items-center justify-between gap-2 bg-primary/10 px-3 py-2 border-b">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {selectedCityData.shortLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedCityData.entries.length} anggota terkait
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setActivePlace(null)}
                    title="Kembali ke daftar kota"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {selectedCityData.entries.map(({ person, roles }) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onSelectPerson?.(person.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/70 px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              person.gender === 'male'
                                ? 'bg-sky-500'
                                : person.gender === 'female'
                                  ? 'bg-rose-500'
                                  : 'bg-slate-400'
                            )}
                          />
                          <span className="truncate font-semibold text-foreground">
                            {person.fullName}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 pl-3.5">
                          {roles.includes('birth') && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9.5px] font-medium text-emerald-700 dark:text-emerald-300">
                              <Baby className="h-2.5 w-2.5" /> Lahir
                            </span>
                          )}
                          {roles.includes('residence') && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/10 px-1.5 py-0.2 text-[9.5px] font-medium text-sky-700 dark:text-sky-300">
                              <Home className="h-2.5 w-2.5" /> Domisili
                            </span>
                          )}
                          {roles.includes('death') && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.2 text-[9.5px] font-medium text-amber-700 dark:text-amber-300">
                              <Cross className="h-2.5 w-2.5" /> Wafat
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredMarkers.length > 0 ? (
                  filteredMarkers.map((m) => (
                    <button
                      key={m.place}
                      type="button"
                      onClick={() => handleSelectCity(m)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {m.shortLabel}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {[
                            m.birthCount > 0 ? `${m.birthCount} lahir` : null,
                            m.residenceCount > 0 ? `${m.residenceCount} domisili` : null,
                            m.deathCount > 0 ? `${m.deathCount} wafat` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
                        {m.entries.length}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Belum ada lokasi yang cocok.
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Full-Height Leaflet Canvas */}
        <div className="relative flex-1 min-w-0 h-full">
          <MapContainer
            center={[-2.5, 118]}
            zoom={5}
            scrollWheelZoom={true}
            className="h-full w-full z-0"
          >
            <MapController markers={markers} fitTrigger={fitTrigger} flyTarget={flyTarget} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {markers.map((m) => {
              const isActive = activePlace === m.place;
              return (
                <Marker
                  key={m.place}
                  position={[m.lat, m.lon]}
                  icon={createClusterBadgeIcon(m.entries.length, isActive)}
                  eventHandlers={{
                    click: () => setActivePlace(m.place),
                  }}
                >
                  <Popup>
                    <div className="min-w-[210px] p-1">
                      <div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-2">
                        <h3 className="text-xs font-bold">{m.shortLabel}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {m.entries.length} orang
                        </span>
                      </div>
                      <div className="max-h-[190px] space-y-1 overflow-y-auto pr-1">
                        {m.entries.map(({ person, roles }) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => onSelectPerson?.(person.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  'h-2 w-2 shrink-0 rounded-full',
                                  person.gender === 'male'
                                    ? 'bg-sky-500'
                                    : person.gender === 'female'
                                      ? 'bg-rose-500'
                                      : 'bg-slate-400'
                                )}
                              />
                              <span className="truncate font-medium">{person.fullName}</span>
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {roles.includes('birth')
                                ? 'Lahir'
                                : roles.includes('residence')
                                  ? 'Domisili'
                                  : 'Wafat'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Empty State Overlay */}
          {markers.length === 0 && loadingRemoteCount === 0 && (
            <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-border/80 bg-card/95 p-5 text-center shadow-lg backdrop-blur-sm">
                <Navigation className="mx-auto h-8 w-8 text-primary mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  Belum Ada Lokasi Terpetakan
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Isi kolom Tempat Lahir atau Domisili pada profil anggota keluarga (misal:
                  Jakarta, Padang, Bandung, Surabaya) untuk melihat sebarannya di peta.
                </p>
              </div>
            </div>
          )}

          {/* Bottom Legend Pill */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 rounded-xl border border-border/70 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> 1–4 anggota
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> 5+ anggota
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-primary" /> Klik angka pin atau kota di daftar kiri
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
