export interface MessageEntry {
  id: number;
  authorUserId: number;
  authorName: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  canDelete: boolean;
}

export interface MessagePageDto {
  items: MessageEntry[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
}

export interface MessagePageQuery {
  page?: number;
  size?: number;
}

export interface MessageCreateInput {
  content: string;
}

export interface MessageDraft {
  content: string;
  imageFile?: File | null;
}
