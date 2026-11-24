export type DateQualifier =
  | 'exact'
  | 'before'
  | 'after'
  | 'circa'
  | 'unsure'
  | 'between'
  | 'from_to'
  | 'from'
  | 'to'
  | 'free_text'
  | 'unknown';

export interface PartialDateParts {
  year?: number;
  month?: number; // 1-12
  day?: number; // 1-31
}

export interface ParsedFlexibleDate {
  raw: string;
  qualifier: DateQualifier;
  date1: PartialDateParts;
  date2?: PartialDateParts;
  freeText?: string;
  /** True only when qualifier === 'exact' and year, month, day are all present */
  isExactFullDate: boolean;
  /** True when month & day are known for a single date (exact, circa, unsure) -> eligible for Birthday Calendar */
  hasSpecificMonthDay: boolean;
  /** True when month is known for a single date (exact, circa, unsure) -> eligible for Birth Month stats */
  hasSpecificMonth: boolean;
  /** Best single year estimate (or midpoint for between/from_to) -> eligible for Age/Generation stats & sorting */
  estimatedYear: number | null;
  /** True when date is not an exact full YYYY-MM-DD */
  isApproximate: boolean;
}

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export const QUALIFIER_OPTIONS: {
  value: DateQualifier;
  label: string;
  myHeritageLabel: string;
}[] = [
  { value: 'exact', label: 'Tepat (Exactly)', myHeritageLabel: 'Exactly' },
  { value: 'before', label: 'Sebelum (Before)', myHeritageLabel: 'Before' },
  { value: 'after', label: 'Setelah (After)', myHeritageLabel: 'After' },
  { value: 'circa', label: 'Sekitar (Circa)', myHeritageLabel: 'Circa' },
  { value: 'unsure', label: 'Tanggal belum pasti (Unsure)', myHeritageLabel: 'Unsure date' },
  { value: 'between', label: 'Antara ... dan ... (Between)', myHeritageLabel: 'Between ... and ...' },
  { value: 'from_to', label: 'Dari ... sampai ... (From ... to)', myHeritageLabel: 'From ... to ...' },
  { value: 'from', label: 'Sejak / Dari (From)', myHeritageLabel: 'From' },
  { value: 'to', label: 'Sampai (To)', myHeritageLabel: 'To' },
  { value: 'free_text', label: 'Teks bebas (Free text)', myHeritageLabel: 'Free text' },
  { value: 'unknown', label: 'Tidak diketahui (Unknown)', myHeritageLabel: 'Unknown' },
];

/**
 * Parse a single partial date token like:
 * - "1991-05-02" -> { year: 1991, month: 5, day: 2 }
 * - "1991-05"    -> { year: 1991, month: 5 }
 * - "1991"       -> { year: 1991 }
 * - "--05-02"    -> { month: 5, day: 2 }
 * - "--05"       -> { month: 5 }
 */
export function parsePartialDateToken(token: string): PartialDateParts | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // 1. Full ISO YYYY-MM-DD (or YYYY-M-D)
  const fullMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (fullMatch) {
    const year = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10);
    const day = parseInt(fullMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  // 2. Year and Month: YYYY-MM or YYYY-00-DD (if someone omitted month)
  const ymMatch = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (ymMatch) {
    const year = parseInt(ymMatch[1], 10);
    const month = parseInt(ymMatch[2], 10);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  // 3. Year and Day without Month: YYYY--DD
  const ydMatch = /^(\d{4})--(\d{1,2})$/.exec(trimmed);
  if (ydMatch) {
    const year = parseInt(ydMatch[1], 10);
    const day = parseInt(ydMatch[2], 10);
    if (day >= 1 && day <= 31) {
      return { year, day };
    }
  }

  // 4. Year only: YYYY
  const yMatch = /^(\d{4})$/.exec(trimmed);
  if (yMatch) {
    return { year: parseInt(yMatch[1], 10) };
  }

  // 5. Month and Day without Year: --MM-DD
  const mdMatch = /^--(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (mdMatch) {
    const month = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }

  // 6. Month only without Year: --MM
  const mMatch = /^--(\d{1,2})$/.exec(trimmed);
  if (mMatch) {
    const month = parseInt(mMatch[1], 10);
    if (month >= 1 && month <= 12) {
      return { month };
    }
  }

  // 7. Day only without Year/Month: ---DD
  const dMatch = /^---(\d{1,2})$/.exec(trimmed);
  if (dMatch) {
    const day = parseInt(dMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return { day };
    }
  }

  return null;
}

/**
 * Serialize PartialDateParts into canonical token
 */
export function encodePartialDateToken(parts?: PartialDateParts | null): string {
  if (!parts) return '';
  const { year, month, day } = parts;
  const yStr = year && year >= 100 && year <= 9999 ? String(year).padStart(4, '0') : '';
  const mStr = month && month >= 1 && month <= 12 ? String(month).padStart(2, '0') : '';
  const dStr = day && day >= 1 && day <= 31 ? String(day).padStart(2, '0') : '';

  if (yStr && mStr && dStr) return `${yStr}-${mStr}-${dStr}`;
  if (yStr && mStr) return `${yStr}-${mStr}`;
  if (yStr && dStr) return `${yStr}--${dStr}`;
  if (yStr) return yStr;
  if (mStr && dStr) return `--${mStr}-${dStr}`;
  if (mStr) return `--${mStr}`;
  if (dStr) return `---${dStr}`;
  return '';
}

/**
 * Serialize structured date state into a canonical string for storage in `birthDate` / `deathDate`
 */
export function serializeFlexibleDate(input: {
  qualifier: DateQualifier;
  date1?: PartialDateParts;
  date2?: PartialDateParts;
  freeText?: string;
}): string {
  const { qualifier, date1, date2, freeText } = input;

  if (qualifier === 'unknown') {
    return 'UNKNOWN';
  }

  if (qualifier === 'free_text') {
    const cleaned = (freeText || '').trim();
    return cleaned ? `TEXT:${cleaned}` : '';
  }

  const token1 = encodePartialDateToken(date1);
  const token2 = encodePartialDateToken(date2);

  if (qualifier === 'between') {
    if (token1 && token2) return `BET ${token1} AND ${token2}`;
    if (token1) return `ABT ${token1}`;
    if (token2) return `ABT ${token2}`;
    return '';
  }

  if (qualifier === 'from_to') {
    if (token1 && token2) return `FROM ${token1} TO ${token2}`;
    if (token1) return `FROM ${token1}`;
    if (token2) return `TO ${token2}`;
    return '';
  }

  if (!token1) return '';

  switch (qualifier) {
    case 'exact':
      return token1;
    case 'before':
      return `BEF ${token1}`;
    case 'after':
      return `AFT ${token1}`;
    case 'circa':
      return `ABT ${token1}`;
    case 'unsure':
      return `EST ${token1}`;
    case 'from':
      return `FROM ${token1}`;
    case 'to':
      return `TO ${token1}`;
    default:
      return token1;
  }
}

/**
 * Parse any stored date string (ISO YYYY-MM-DD, GEDCOM-like flexible string, or legacy text)
 */
export function parseFlexibleDate(dateStr?: string | null): ParsedFlexibleDate | null {
  if (!dateStr) return null;
  const raw = dateStr.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();

  // 1. UNKNOWN
  if (upper === 'UNKNOWN' || upper === 'TIDAK DIKETAHUI') {
    return buildParsedResult(raw, 'unknown', {});
  }

  // 2. Explicit Free Text
  if (raw.startsWith('TEXT:')) {
    const text = raw.slice(5).trim();
    return buildParsedResult(raw, 'free_text', {}, undefined, text);
  }

  // 3. Range: BET <t1> AND <t2> or "Antara <t1> dan <t2>"
  const betMatch = /^(?:BET|BETWEEN|ANTARA)\s+(.+?)\s+(?:AND|DAN|-|–)\s+(.+)$/i.exec(raw);
  if (betMatch) {
    const p1 = parsePartialDateToken(betMatch[1]);
    const p2 = parsePartialDateToken(betMatch[2]);
    if (p1 && p2) {
      return buildParsedResult(raw, 'between', p1, p2);
    }
  }

  // 4. Range: FROM <t1> TO <t2> or "Dari <t1> sampai <t2>"
  const fromToMatch = /^(?:FROM|DARI)\s+(.+?)\s+(?:TO|SAMPAI|HINGGA)\s+(.+)$/i.exec(raw);
  if (fromToMatch) {
    const p1 = parsePartialDateToken(fromToMatch[1]);
    const p2 = parsePartialDateToken(fromToMatch[2]);
    if (p1 && p2) {
      return buildParsedResult(raw, 'from_to', p1, p2);
    }
  }

  // 5. Single date with prefix qualifier
  const prefixPatterns: { regex: RegExp; qualifier: DateQualifier }[] = [
    { regex: /^(?:BEF|BEFORE|SEBELUM)\s+(.+)$/i, qualifier: 'before' },
    { regex: /^(?:AFT|AFTER|SETELAH|SESUDAH)\s+(.+)$/i, qualifier: 'after' },
    { regex: /^(?:ABT|CIRCA|CA\.?|C\.|SEKITAR|KIRA-KIRA|~)\s*(.+)$/i, qualifier: 'circa' },
    { regex: /^(?:EST|UNSURE|BELUM PASTI|\?)\s*(.+)$/i, qualifier: 'unsure' },
    { regex: /^(?:FROM|SEJAK|DARI)\s+(.+)$/i, qualifier: 'from' },
    { regex: /^(?:TO|SAMPAI|HINGGA)\s+(.+)$/i, qualifier: 'to' },
  ];

  for (const { regex, qualifier } of prefixPatterns) {
    const m = regex.exec(raw);
    if (m) {
      const p1 = parsePartialDateToken(m[1]);
      if (p1) {
        return buildParsedResult(raw, qualifier, p1);
      }
    }
  }

  // 6. Exact or partial date token without prefix
  const directParts = parsePartialDateToken(raw);
  if (directParts) {
    return buildParsedResult(raw, 'exact', directParts);
  }

  // 7. Try standard Date parse if it's an ISO timestamp like 1991-05-02T00:00:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return buildParsedResult(raw, 'exact', {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      });
    }
  }

  // 8. Fallback: treat as free_text (and extract a 4-digit year if mentioned inside free text)
  const embeddedYearMatch = /\b(1[5-9]\d{2}|20\d{2})\b/.exec(raw);
  const embeddedParts: PartialDateParts = embeddedYearMatch
    ? { year: parseInt(embeddedYearMatch[1], 10) }
    : {};
  return buildParsedResult(raw, 'free_text', embeddedParts, undefined, raw);
}

function buildParsedResult(
  raw: string,
  qualifier: DateQualifier,
  date1: PartialDateParts,
  date2?: PartialDateParts,
  freeText?: string
): ParsedFlexibleDate {
  const isExactFullDate =
    qualifier === 'exact' &&
    typeof date1.year === 'number' &&
    typeof date1.month === 'number' &&
    typeof date1.day === 'number';

  const isSingleDateCompatible =
    qualifier === 'exact' || qualifier === 'circa' || qualifier === 'unsure';

  const hasSpecificMonthDay =
    isSingleDateCompatible &&
    typeof date1.month === 'number' &&
    typeof date1.day === 'number';

  const hasSpecificMonth =
    isSingleDateCompatible && typeof date1.month === 'number';

  let estimatedYear: number | null = null;
  if (qualifier === 'between' || qualifier === 'from_to') {
    if (typeof date1.year === 'number' && typeof date2?.year === 'number') {
      estimatedYear = Math.round((date1.year + date2.year) / 2);
    } else if (typeof date1.year === 'number') {
      estimatedYear = date1.year;
    } else if (typeof date2?.year === 'number') {
      estimatedYear = date2.year;
    }
  } else if (typeof date1.year === 'number') {
    estimatedYear = date1.year;
  }

  const isApproximate = !isExactFullDate;

  return {
    raw,
    qualifier,
    date1,
    date2,
    freeText,
    isExactFullDate,
    hasSpecificMonthDay,
    hasSpecificMonth,
    estimatedYear,
    isApproximate,
  };
}

/**
 * Format partial date parts into Indonesian string (e.g. "17 Agustus 1945", "Mei 1950", "1950", "17 Agustus")
 */
export function formatPartialDatePartsId(
  parts?: PartialDateParts,
  shortMonth = false
): string {
  if (!parts) return '';
  const { year, month, day } = parts;
  const monthList = shortMonth ? INDONESIAN_MONTHS_SHORT : INDONESIAN_MONTHS;
  const mName = month && month >= 1 && month <= 12 ? monthList[month - 1] : '';

  if (day && mName && year) return `${day} ${mName} ${year}`;
  if (mName && year) return `${mName} ${year}`;
  if (day && mName) return `${day} ${mName}`;
  if (day && year) return `Tgl ${day}, ${year}`;
  if (year) return `${year}`;
  if (mName) return `Bulan ${mName}`;
  if (day) return `Tanggal ${day}`;
  return '';
}

/**
 * Format any flexible date string into clean Indonesian text for profile details, stories, and tooltips.
 */
export function formatFlexibleDate(
  dateStr?: string | null,
  options?: { shortMonth?: boolean; fallback?: string | null }
): string | null {
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return options?.fallback ?? null;

  const shortMonth = options?.shortMonth ?? false;
  const d1 = formatPartialDatePartsId(parsed.date1, shortMonth);
  const d2 = formatPartialDatePartsId(parsed.date2, shortMonth);

  switch (parsed.qualifier) {
    case 'exact':
      return d1 || (options?.fallback ?? null);
    case 'before':
      return d1 ? `Sebelum ${d1}` : (options?.fallback ?? null);
    case 'after':
      return d1 ? `Setelah ${d1}` : (options?.fallback ?? null);
    case 'circa':
      return d1 ? `Sekitar ${d1}` : (options?.fallback ?? null);
    case 'unsure':
      return d1 ? `${d1} (belum pasti)` : (options?.fallback ?? null);
    case 'between':
      if (d1 && d2) return `Antara ${d1} dan ${d2}`;
      return d1 ? `Sekitar ${d1}` : (options?.fallback ?? null);
    case 'from_to':
      if (d1 && d2) return `Dari ${d1} sampai ${d2}`;
      return d1 ? `Sejak ${d1}` : (options?.fallback ?? null);
    case 'from':
      return d1 ? `Sejak ${d1}` : (options?.fallback ?? null);
    case 'to':
      return d1 ? `Sampai ${d1}` : (options?.fallback ?? null);
    case 'free_text':
      return parsed.freeText || (options?.fallback ?? null);
    case 'unknown':
      return 'Tanggal tidak diketahui';
    default:
      return d1 || (options?.fallback ?? null);
  }
}

/**
 * Format a compact year/date label for tree nodes, badges, and tables (e.g. "1950", "~1950", "<1960", "1945–1950")
 */
export function formatShortYearLabel(dateStr?: string | null): string | null {
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return null;

  const y1 = parsed.date1.year;
  const y2 = parsed.date2?.year;

  switch (parsed.qualifier) {
    case 'exact':
      if (y1) return String(y1);
      return formatPartialDatePartsId(parsed.date1, true) || null;
    case 'circa':
      if (y1) return `~${y1}`;
      return parsed.date1.month ? `~${ formatPartialDatePartsId(parsed.date1, true) }` : null;
    case 'unsure':
      if (y1) return `${y1}?`;
      return formatPartialDatePartsId(parsed.date1, true) || null;
    case 'before':
      if (y1) return `<${y1}`;
      return null;
    case 'after':
      if (y1) return `>${y1}`;
      return null;
    case 'between':
    case 'from_to':
      if (y1 && y2) return `${y1}–${y2}`;
      if (y1) return `~${y1}`;
      if (y2) return `~${y2}`;
      return null;
    case 'from':
      if (y1) return `${y1}–`;
      return null;
    case 'to':
      if (y1) return `–${y1}`;
      return null;
    case 'free_text':
      if (y1) return `~${y1}`;
      return parsed.freeText ? parsed.freeText.slice(0, 18) : null;
    case 'unknown':
      return '?';
    default:
      return y1 ? String(y1) : null;
  }
}

/**
 * Format lifespan for tables/cards (e.g. "1950 – 2020", "~1945 – ?", "~1950")
 */
export function formatLifeSpan(
  birthDate?: string | null,
  deathDate?: string | null,
  fallback = '—'
): string {
  const birthLabel = formatShortYearLabel(birthDate);
  const deathLabel = formatShortYearLabel(deathDate);

  if (birthLabel && deathLabel) {
    return `${birthLabel} – ${deathLabel}`;
  }
  if (birthLabel && deathDate) {
    return `${birthLabel} – ?`;
  }
  if (birthLabel) {
    return birthLabel;
  }
  if (deathLabel) {
    return `? – ${deathLabel}`;
  }
  return fallback;
}

/**
 * Extract estimated numeric year for statistics, age calculations, generation sorting, and validations.
 * Never returns NaN (returns null if no year is available).
 */
export function getEstimatedYear(dateStr?: string | null): number | null {
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return null;
  return parsed.estimatedYear;
}

/**
 * Get a numeric timestamp for chronological sorting. Returns null if no year is available.
 */
export function getSortableTimestamp(dateStr?: string | null): number | null {
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed || parsed.estimatedYear === null) return null;

  const year = parsed.estimatedYear;
  const month = (parsed.date1.month ?? 1) - 1;
  const day = parsed.date1.day ?? 1;

  const d = new Date(year, month, day);
  const time = d.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Calculate age (either current age or age at death) supporting flexible dates.
 */
export function calculateFlexibleAge(
  birthDate?: string | null,
  deathDate?: string | null
): { age: number; isApproximate: boolean } | null {
  const birthParsed = parseFlexibleDate(birthDate);
  if (!birthParsed || birthParsed.estimatedYear === null) return null;

  const now = new Date();
  let endYear = now.getFullYear();
  let endMonth = now.getMonth() + 1;
  let endDay = now.getDate();
  let deathApproximate = false;

  if (deathDate) {
    const deathParsed = parseFlexibleDate(deathDate);
    if (!deathParsed || deathParsed.estimatedYear === null) {
      // Person is deceased, but death year is unknown -> cannot compute exact age at death
      return null;
    }
    endYear = deathParsed.estimatedYear;
    endMonth = deathParsed.date1.month ?? 12;
    endDay = deathParsed.date1.day ?? 28;
    deathApproximate = deathParsed.isApproximate;
  }

  let age = endYear - birthParsed.estimatedYear;

  if (birthParsed.date1.month) {
    const bMonth = birthParsed.date1.month;
    const bDay = birthParsed.date1.day ?? 1;
    if (endMonth < bMonth || (endMonth === bMonth && endDay < bDay)) {
      age--;
    }
  }

  if (age < 0) return null;

  return {
    age,
    isApproximate: birthParsed.isApproximate || deathApproximate,
  };
}
