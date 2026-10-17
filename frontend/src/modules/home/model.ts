export interface HomeAnniversary {
  name: string;
  date: string;
  daysUntil: number;
  type: string;
}

export interface HomeCouple {
  boyfriendName: string;
  girlfriendName: string;
  startedOn: string;
  togetherDays: number;
  nextAnniversary: HomeAnniversary;
}

export interface HomeDailyNote {
  date: string;
  sentence: string;
  weatherHint: string;
  activityHint: string;
}

export interface HomePersonStatus {
  role: string;
  name: string;
  city: string;
  district?: string;
  province?: string;
  country?: string;
  weather: string;
  temperature: number | null;
  mood: string;
  note: string;
  lastOnlineAt: string | null;
}

export interface HomeDistance {
  kilometers: number | null;
  label: string;
  status: string;
  updatedAt: string | null;
}

export interface HomeLatestDiary {
  id: number;
  title: string;
  entryDate: string;
  content: string;
  tag: string;
}

export interface HomeLatestPhoto {
  id: number;
  previewUrl: string;
  caption: string;
  takenAt: string;
}

export interface HomeLatestWish {
  id: number;
  title: string;
  done: boolean;
  note?: string | null;
  place?: string | null;
  completedAt?: string | null;
  category?: string | null;
}

export interface HomeLatestMessage {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface HomeLatest {
  diary: HomeLatestDiary | null;
  photo: HomeLatestPhoto | null;
  wish: HomeLatestWish | null;
  message: HomeLatestMessage | null;
}

export interface HomeStats {
  photoCount: number | null;
  messageCount: number | null;
  wishCount: number | null;
  completedWishCount: number | null;
}

export interface HomeOverview {
  couple: HomeCouple;
  dailyNote: HomeDailyNote;
  personStatuses: HomePersonStatus[];
  distance: HomeDistance;
  latest: HomeLatest;
  stats: HomeStats;
}

export interface HomeLocationSnapshot {
  latitude: number;
  longitude: number;
  city: string;
  district: string;
  province: string;
  country: string;
  weather: string | null;
  temperature: number | null;
}
