export type DiaryRole = 'boyfriend' | 'girlfriend';
export type DiaryVisibility = 'shared' | 'private';
export type DiaryMoodKey =
  | 'happy'
  | 'miss'
  | 'calm'
  | 'wronged'
  | 'expecting'
  | 'tired'
  | 'sweet'
  | 'secret'
  | 'angry'
  | 'touched';

export interface DiaryMoodOption {
  key: DiaryMoodKey;
  label: string;
}

export interface DiaryMonthStatDto {
  month: string;
  count: number;
  hasEntries: boolean;
}

export interface DiaryYearStatDto {
  year: number;
  months: DiaryMonthStatDto[];
}

export interface DiaryArchiveDto {
  years: DiaryYearStatDto[];
}

export interface DiarySummaryDto {
  id: number;
  role: DiaryRole;
  authorName: string;
  authorAvatar: string;
  title: string;
  summary: string;
  imageUrls: string[];
  entryDate: string;
  moodKey: DiaryMoodKey;
  locationName: string | null;
  weather: string | null;
  visibility: DiaryVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryMonthDto {
  month: string;
  items: DiarySummaryDto[];
}

export interface DiaryDetailDto extends DiarySummaryDto {
  contentMarkdown: string;
  rawWeather: string | null;
  temperature: number | null;
  windDirection: string | null;
  windPower: string | null;
  humidity: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DiaryWeatherSnapshot {
  weather?: string;
  rawWeather?: string;
  temperature?: number | null;
  windDirection?: string;
  windPower?: string;
  humidity?: string;
  province?: string;
  city?: string;
  district?: string;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DiaryCreateInput {
  contentMarkdown: string;
  date: string;
  moodKey: DiaryMoodKey;
  visibility: DiaryVisibility;
  weatherSnapshot?: DiaryWeatherSnapshot;
}

export interface DiaryUpdateInput {
  contentMarkdown: string;
  moodKey: DiaryMoodKey;
  visibility: DiaryVisibility;
}

export interface DiaryImageUploadDto {
  uploadId: number;
  url: string;
}

export interface DiaryEditorValue {
  title: string;
  content: string;
  date: string;
  moodKey: DiaryMoodKey;
  location: string;
  weather: string;
  visibility: DiaryVisibility;
}

export interface DiaryEntry {
  id: number;
  role: DiaryRole;
  authorName: string;
  authorAvatar: string;
  title: string;
  content: string;
  images: string[];
  date: string;
  moodKey: DiaryMoodKey;
  mood: string;
  location: string;
  weather: string;
  visibility: DiaryVisibility;
  createdAt: string;
  updatedAt: string;
  rawWeather?: string;
  temperature?: number | null;
  windDirection?: string;
  windPower?: string;
  humidity?: string;
  province?: string;
  city?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DiaryDayGroup {
  key: string;
  label: string;
  weekday: string;
  entriesByRole: Record<DiaryRole, DiaryEntry | null>;
}

export interface DiaryMonthGroup {
  key: string;
  label: string;
  days: DiaryDayGroup[];
}

export interface DiaryMonthChapter {
  key: string;
  year: number;
  monthNumber: number;
  label: string;
  count: number;
  hasEntries: boolean;
}

export interface DiaryYearChapter {
  year: number;
  months: DiaryMonthChapter[];
}

export interface DiaryCoordinates {
  latitude: number;
  longitude: number;
}

export interface DiaryWeatherContext<TWeather = unknown> {
  weather: TWeather | null | undefined;
  coordinates: DiaryCoordinates | null | undefined;
}

export interface DiarySaveResult {
  entry: DiaryEntry;
  monthChanged: boolean;
  created: boolean;
}
