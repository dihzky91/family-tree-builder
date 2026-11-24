import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, CalendarCheck2, Info } from 'lucide-react';
import {
  type DateQualifier,
  type PartialDateParts,
  INDONESIAN_MONTHS,
  QUALIFIER_OPTIONS,
  parseFlexibleDate,
  serializeFlexibleDate,
  formatFlexibleDate,
} from '@/lib/flexibleDateUtils';
import { cn } from '@/lib/utils';

export interface FlexibleDateInputProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  /** Whether to show "Tidak diketahui" option (useful for death dates or uncertain records) */
  allowUnknown?: boolean;
  /** Optional placeholder for free text mode */
  freeTextPlaceholder?: string;
  className?: string;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface DatePartsRowProps {
  parts: PartialDateParts;
  onChange: (next: PartialDateParts) => void;
  disabled?: boolean;
}

function DatePartsRow({ parts, onChange, disabled }: DatePartsRowProps) {
  const [yearInput, setYearInput] = React.useState<string>(
    parts.year ? String(parts.year) : ''
  );

  React.useEffect(() => {
    setYearInput(parts.year ? String(parts.year) : '');
  }, [parts.year]);

  const handleMonthChange = (val: string) => {
    const month = val === 'none' ? undefined : parseInt(val, 10);
    onChange({ ...parts, month });
  };

  const handleDayChange = (val: string) => {
    const day = val === 'none' ? undefined : parseInt(val, 10);
    onChange({ ...parts, day });
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearInput(raw);
    if (!raw) {
      onChange({ ...parts, year: undefined });
    } else if (raw.length === 4) {
      const y = parseInt(raw, 10);
      if (!Number.isNaN(y)) {
        onChange({ ...parts, year: y });
      }
    }
  };

  const handleYearBlur = () => {
    if (!yearInput) {
      onChange({ ...parts, year: undefined });
      return;
    }
    const y = parseInt(yearInput, 10);
    if (!Number.isNaN(y) && y >= 100 && y <= 9999) {
      onChange({ ...parts, year: y });
    } else {
      setYearInput(parts.year ? String(parts.year) : '');
    }
  };

  return (
    <div className="grid grid-cols-12 gap-1.5">
      {/* Month Select */}
      <div className="col-span-5">
        <Select
          disabled={disabled}
          value={parts.month ? String(parts.month) : 'none'}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="h-9 px-2.5 text-xs">
            <SelectValue placeholder="Bulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-muted-foreground text-xs">
              - Bulan -
            </SelectItem>
            {INDONESIAN_MONTHS.map((m, idx) => (
              <SelectItem key={m} value={String(idx + 1)} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day Select */}
      <div className="col-span-3">
        <Select
          disabled={disabled}
          value={parts.day ? String(parts.day) : 'none'}
          onValueChange={handleDayChange}
        >
          <SelectTrigger className="h-9 px-2 text-xs">
            <SelectValue placeholder="Tgl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-muted-foreground text-xs">
              - Tgl -
            </SelectItem>
            {DAYS.map((d) => (
              <SelectItem key={d} value={String(d)} className="text-xs">
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year Input */}
      <div className="col-span-4">
        <Input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={yearInput}
          onChange={handleYearChange}
          onBlur={handleYearBlur}
          placeholder="Tahun"
          className="h-9 px-2.5 text-xs"
          maxLength={4}
        />
      </div>
    </div>
  );
}

export function FlexibleDateInput({
  id,
  value,
  onChange,
  allowUnknown = true,
  freeTextPlaceholder = 'Contoh: Zaman kemerdekaan, usia sekitar 70 thn...',
  className,
}: FlexibleDateInputProps) {
  const parsed = React.useMemo(() => parseFlexibleDate(value), [value]);

  const [qualifier, setQualifier] = React.useState<DateQualifier>(
    parsed?.qualifier || 'exact'
  );
  const [date1, setDate1] = React.useState<PartialDateParts>(
    parsed?.date1 || {}
  );
  const [date2, setDate2] = React.useState<PartialDateParts>(
    parsed?.date2 || {}
  );
  const [freeText, setFreeText] = React.useState<string>(
    parsed?.freeText || ''
  );

  // Sync from external value changes (e.g. form reset or loading another person)
  const lastEmittedRef = React.useRef<string>(value || '');
  React.useEffect(() => {
    const incoming = value || '';
    if (incoming === lastEmittedRef.current) return;
    lastEmittedRef.current = incoming;

    const nextParsed = parseFlexibleDate(incoming);
    if (!nextParsed) {
      setQualifier('exact');
      setDate1({});
      setDate2({});
      setFreeText('');
      return;
    }
    setQualifier(nextParsed.qualifier);
    setDate1(nextParsed.date1 || {});
    setDate2(nextParsed.date2 || {});
    setFreeText(nextParsed.freeText || '');
  }, [value]);

  const emitChange = (
    nextQualifier: DateQualifier,
    nextDate1: PartialDateParts,
    nextDate2: PartialDateParts,
    nextFreeText: string
  ) => {
    const serialized = serializeFlexibleDate({
      qualifier: nextQualifier,
      date1: nextDate1,
      date2: nextDate2,
      freeText: nextFreeText,
    });
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  const handleQualifierChange = (nextQ: DateQualifier) => {
    setQualifier(nextQ);
    emitChange(nextQ, date1, date2, freeText);
  };

  const handleDate1Change = (nextD1: PartialDateParts) => {
    setDate1(nextD1);
    emitChange(qualifier, nextD1, date2, freeText);
  };

  const handleDate2Change = (nextD2: PartialDateParts) => {
    setDate2(nextD2);
    emitChange(qualifier, date1, nextD2, freeText);
  };

  const handleFreeTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setFreeText(txt);
    emitChange(qualifier, date1, date2, txt);
  };

  const handleClear = () => {
    setQualifier('exact');
    setDate1({});
    setDate2({});
    setFreeText('');
    lastEmittedRef.current = '';
    onChange('');
  };

  const availableQualifiers = React.useMemo(
    () =>
      allowUnknown
        ? QUALIFIER_OPTIONS
        : QUALIFIER_OPTIONS.filter((q) => q.value !== 'unknown'),
    [allowUnknown]
  );

  const previewText = formatFlexibleDate(value);
  const currentParsed = parseFlexibleDate(value);

  const isRange = qualifier === 'between' || qualifier === 'from_to';
  const isSingleDate =
    qualifier === 'exact' ||
    qualifier === 'before' ||
    qualifier === 'after' ||
    qualifier === 'circa' ||
    qualifier === 'unsure' ||
    qualifier === 'from' ||
    qualifier === 'to';

  return (
    <div id={id} className={cn('space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2.5', className)}>
      {/* Top Row: Qualifier Select + Clear Button */}
      <div className="flex items-center gap-1.5">
        <Select
          value={qualifier}
          onValueChange={(v) => handleQualifierChange(v as DateQualifier)}
        >
          <SelectTrigger className="h-9 text-xs font-medium flex-1 bg-background">
            <SelectValue placeholder="Pilih tipe tanggal" />
          </SelectTrigger>
          <SelectContent>
            {availableQualifiers.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {Boolean(value) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            title="Kosongkan tanggal"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Single Date Mode (Month / Day / Year) */}
      {isSingleDate && (
        <DatePartsRow parts={date1} onChange={handleDate1Change} />
      )}

      {/* Range Mode (Between ... and ... / From ... to ...) */}
      {isRange && (
        <div className="space-y-1.5">
          <DatePartsRow parts={date1} onChange={handleDate1Change} />
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-medium text-muted-foreground">
              {qualifier === 'between' ? 'dan' : 'sampai'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <DatePartsRow parts={date2} onChange={handleDate2Change} />
        </div>
      )}

      {/* Free Text Mode */}
      {qualifier === 'free_text' && (
        <Input
          value={freeText}
          onChange={handleFreeTextChange}
          placeholder={freeTextPlaceholder}
          className="h-9 text-xs bg-background"
        />
      )}

      {/* Preview & Info Line */}
      {previewText ? (
        <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
            <CalendarCheck2 className="w-3 h-3 text-primary shrink-0" />
            {previewText}
          </span>
          {currentParsed && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Info className="w-2.5 h-2.5 shrink-0" />
              {currentParsed.hasSpecificMonthDay
                ? 'Masuk Kalender Ultah & Statistik'
                : currentParsed.estimatedYear !== null
                  ? 'Hanya masuk Statistik Tahun/Usia'
                  : 'Tidak masuk Kalender Ultah'}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/80 px-0.5">
          Bisa diisi lengkap, hanya Tahun saja, atau Bulan & Tahun saja.
        </p>
      )}
    </div>
  );
}
