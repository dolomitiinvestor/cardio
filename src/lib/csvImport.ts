import Papa from 'papaparse';
import { format, isValid, parseISO } from 'date-fns';
import type { CardioType, NewActivity } from './types';
import { CARDIO_TYPES } from './types';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
        });
      },
      error: (err: Error) => reject(err),
    });
  });
}

export type DistanceUnit = 'miles' | 'km' | 'meters';
export type DurationUnit = 'seconds' | 'minutes' | 'hms';

export interface ColumnMapping {
  dateColumn: string;
  typeColumn: string;
  distanceColumn: string;
  distanceUnit: DistanceUnit;
  durationColumn: string;
  durationUnit: DurationUnit;
}

const DATE_HEADER_CANDIDATES = ['activity date', 'date', 'start date', 'start time'];
const TYPE_HEADER_CANDIDATES = ['activity type', 'type'];
const DISTANCE_HEADER_CANDIDATES = ['distance'];
const DURATION_HEADER_CANDIDATES = ['moving time', 'elapsed time', 'duration', 'time'];

function findHeader(headers: string[], candidates: string[]): string {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx !== -1) return headers[idx];
  }
  // fallback: partial match
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return headers[0] ?? '';
}

export function guessMapping(headers: string[]): ColumnMapping {
  const distanceColumn = findHeader(headers, DISTANCE_HEADER_CANDIDATES);
  // Strava's raw bulk-export "Distance" column is in meters by default.
  const distanceUnit: DistanceUnit = distanceColumn.toLowerCase().trim() === 'distance' ? 'meters' : 'miles';
  return {
    dateColumn: findHeader(headers, DATE_HEADER_CANDIDATES),
    typeColumn: findHeader(headers, TYPE_HEADER_CANDIDATES),
    distanceColumn,
    distanceUnit,
    durationColumn: findHeader(headers, DURATION_HEADER_CANDIDATES),
    durationUnit: 'seconds',
  };
}

const TYPE_ALIASES: Record<string, CardioType> = {
  run: 'Run',
  running: 'Run',
  trailrun: 'Run',
  'trail run': 'Run',
  virtualrun: 'Run',
  ride: 'Bike',
  bike: 'Bike',
  cycling: 'Bike',
  virtualride: 'Bike',
  ebikeride: 'Bike',
  mountainbikeride: 'Bike',
  gravelride: 'Bike',
  swim: 'Swim',
  swimming: 'Swim',
  walk: 'Walk',
  walking: 'Walk',
  hike: 'Hike',
  hiking: 'Hike',
  elliptical: 'Elliptical',
  rowing: 'Row',
  row: 'Row',
  canoeing: 'Row',
  kayaking: 'Row',
};

export function normalizeType(raw: string): CardioType {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  const mapped = TYPE_ALIASES[key] ?? TYPE_ALIASES[raw.toLowerCase().trim()];
  if (mapped) return mapped;
  const direct = CARDIO_TYPES.find((t) => t.toLowerCase() === raw.toLowerCase().trim());
  return direct ?? 'Other';
}

function parseDateFlexible(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO-like: 2024-01-05 or 2024-01-05T08:00:00
  const isoAttempt = parseISO(trimmed);
  if (isValid(isoAttempt)) return format(isoAttempt, 'yyyy-MM-dd');

  // Strava export style: "Jan 5, 2024, 8:00:00 AM" or "Jan 5, 2024"
  const native = new Date(trimmed);
  if (isValid(native) && !isNaN(native.getTime())) return format(native, 'yyyy-MM-dd');

  return null;
}

function parseDistance(raw: string, unit: DistanceUnit): number {
  const value = parseFloat(raw.replace(/,/g, ''));
  if (!isFinite(value)) return 0;
  if (unit === 'miles') return value;
  if (unit === 'km') return value * 0.621371;
  return value / 1609.344; // meters
}

function parseDuration(raw: string, unit: DurationUnit): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (unit === 'hms' || trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => parseFloat(p) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] ?? 0;
  }
  const value = parseFloat(trimmed.replace(/,/g, ''));
  if (!isFinite(value)) return 0;
  return unit === 'minutes' ? value * 60 : value;
}

export interface ImportRowResult {
  activity: NewActivity | null;
  error: string | null;
  raw: Record<string, string>;
}

export function buildActivitiesFromRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  typeFilter: CardioType[] | 'all',
): ImportRowResult[] {
  return rows.map((row) => {
    const dateRaw = row[mapping.dateColumn] ?? '';
    const date = parseDateFlexible(dateRaw);
    if (!date) {
      return { activity: null, error: `Unrecognized date: "${dateRaw}"`, raw: row };
    }

    const typeRaw = row[mapping.typeColumn] ?? 'Other';
    const type = normalizeType(typeRaw);
    if (typeFilter !== 'all' && !typeFilter.includes(type)) {
      return { activity: null, error: null, raw: row }; // filtered out silently
    }

    const distanceMiles = parseDistance(row[mapping.distanceColumn] ?? '0', mapping.distanceUnit);
    const durationSeconds = parseDuration(row[mapping.durationColumn] ?? '0', mapping.durationUnit);

    if (distanceMiles <= 0 && durationSeconds <= 0) {
      return { activity: null, error: 'Empty distance and duration', raw: row };
    }

    return {
      activity: {
        date,
        type,
        distanceMiles: Math.round(distanceMiles * 1000) / 1000,
        durationSeconds: Math.round(durationSeconds),
        source: 'strava',
        notes: row['Activity Name'] ?? undefined,
      },
      error: null,
      raw: row,
    };
  });
}
