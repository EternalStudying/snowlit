export type WishCategory = 'want_go' | 'want_do';

export const WISH_LANE_KEYS = ['wantToGo', 'wantToDo', 'done'] as const;

export type WishLaneKey = (typeof WISH_LANE_KEYS)[number];

export interface WishSummaryDto {
  id: number;
  title: string;
  category: WishCategory;
  completed: boolean;
  imageUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WishDetailDto extends WishSummaryDto {
  description: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  expectedCompletedAt: string | null;
  updatedAt: string;
  lastOperatedByUserId: number | null;
  lastOperatedAt: string | null;
}

export interface WishPageDto {
  items: WishSummaryDto[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
  canManage: boolean;
}

export interface WishPageQuery {
  category?: WishCategory;
  completed: boolean;
  page: number;
  size: number;
}

export interface WishCreateInput {
  title: string;
  category: WishCategory;
  description: string;
  locationName: string;
  expectedCompletedAt: string | null;
  note: string;
}

export interface WishItem {
  id: number;
  title: string;
  description: string;
  location: string;
  imageUrl: string;
  createdAt: string;
  completedAt: string;
  expectedCompletedAt: string;
  note: string;
  lane: WishLaneKey;
  category: WishCategory;
}

export interface WishLaneTransition {
  wishId: number;
  fromLane: WishLaneKey;
  toLane: WishLaneKey;
  wish: WishItem;
}
