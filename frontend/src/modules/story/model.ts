export type StoryCategory =
  | 'daily'
  | 'date'
  | 'travel'
  | 'anniversary'
  | 'surprise';

export type StoryCategoryFilter = StoryCategory | 'all';

export interface StoryCategoryOption {
  key: StoryCategoryFilter;
  label: string;
}

export const STORY_CATEGORY_OPTIONS: StoryCategoryOption[] = [
  { key: 'all', label: '全部' },
  { key: 'daily', label: '日常' },
  { key: 'date', label: '约会' },
  { key: 'travel', label: '旅行' },
  { key: 'anniversary', label: '纪念' },
  { key: 'surprise', label: '惊喜' }
];

export const STORY_CATEGORY_LABELS: Record<StoryCategory, string> = {
  daily: '日常',
  date: '约会',
  travel: '旅行',
  anniversary: '纪念',
  surprise: '惊喜'
};

export interface StoryMoment {
  id: number;
  title: string;
  content: string;
  eventTime: string;
  endTime: string | null;
  locationName: string;
  address: string;
  longitude: number | null;
  latitude: number | null;
  category: StoryCategory;
  images: string[];
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryMomentListDto {
  items: StoryMoment[];
  years: number[];
  canManage: boolean;
}

export interface StoryMomentInput {
  title: string;
  content: string;
  eventTime: string;
  endTime: string | null;
  locationName: string;
  address: string;
  longitude: number;
  latitude: number;
  category: StoryCategory;
  images: string[];
}

export interface StoryMomentFilters {
  category?: StoryCategory;
  year?: number;
}

export interface StoryImageUploadDto {
  url: string;
}

export interface StoryDraftLocation {
  longitude: number;
  latitude: number;
  locationName: string;
  address: string;
}

export interface StoryEditorAnchor {
  x: number;
  y: number;
}

export interface StoryMapLoadingState {
  sdkSettled: boolean;
  instanceReady: boolean;
  markersReady: boolean;
  labelsReady: boolean;
}

export interface StoryMemoryEntry {
  label: '今天的回忆' | '最近点滴';
  moment: StoryMoment;
}
