export type CardioType =
  | 'Run'
  | 'Bike'
  | 'Swim'
  | 'Walk'
  | 'Elliptical'
  | 'Row'
  | 'Hike'
  | 'Other';

export const CARDIO_TYPES: CardioType[] = [
  'Run',
  'Bike',
  'Swim',
  'Walk',
  'Elliptical',
  'Row',
  'Hike',
  'Other',
];

// Types that count toward "running" mileage stats (MPW) by default.
export const RUN_LIKE_TYPES: CardioType[] = ['Run'];

export interface Activity {
  id: string;
  date: string; // YYYY-MM-DD, local date of the activity
  type: CardioType;
  durationSeconds: number;
  distanceMiles: number;
  notes?: string;
  source: 'manual' | 'strava';
  createdAt: string; // ISO timestamp
}

export type NewActivity = Omit<Activity, 'id' | 'createdAt'>;
