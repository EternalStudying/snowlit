import type {
  WishDetailDto,
  WishSummaryDto
} from '../../model';
import type { WishGateway } from '../../internal/ports';

export interface MemoryWishGatewayOptions {
  summaries?: WishSummaryDto[];
  details?: WishDetailDto[];
  canManage?: boolean;
  now?: () => string;
  overrides?: Partial<WishGateway>;
}

export function createMemoryWishGateway({
  summaries: initialSummaries = [],
  details: initialDetails = [],
  canManage = true,
  now = () => new Date().toISOString(),
  overrides = {}
}: MemoryWishGatewayOptions = {}): WishGateway {
  const summaries = new Map(
    initialSummaries.map((summary) => [summary.id, cloneSummary(summary)])
  );
  const details = new Map(
    initialDetails.map((detail) => [detail.id, cloneDetail(detail)])
  );
  let nextId = Math.max(0, ...summaries.keys(), ...details.keys()) + 1;

  return {
    async fetchPage(query) {
      if (overrides.fetchPage) {
        return overrides.fetchPage(query);
      }

      const filtered = [...summaries.values()].filter(
        (summary) =>
          summary.completed === query.completed &&
          (query.category === undefined || summary.category === query.category)
      ).sort((left, right) => compareSummaryOrder(left, right, query.completed));
      const offset = (query.page - 1) * query.size;
      const items = filtered.slice(offset, offset + query.size).map(cloneSummary);

      return {
        items,
        total: filtered.length,
        page: query.page,
        size: query.size,
        hasMore: offset + items.length < filtered.length,
        canManage
      };
    },

    async fetchDetail(id) {
      if (overrides.fetchDetail) {
        return overrides.fetchDetail(id);
      }

      const detail = details.get(id);
      if (detail) {
        return cloneDetail(detail);
      }

      const summary = requireSummary(summaries, id);
      return detailFromSummary(summary, now());
    },

    async createWish(input, image) {
      if (overrides.createWish) {
        return overrides.createWish(input, image);
      }

      const createdAt = now();
      const summary: WishSummaryDto = {
        id: nextId++,
        title: input.title,
        category: input.category,
        completed: false,
        imageUrl: image ? memoryImageUrl(image) : null,
        createdAt,
        completedAt: null
      };
      summaries.set(summary.id, summary);
      details.set(summary.id, {
        ...summary,
        description: input.description,
        locationName: input.locationName || null,
        latitude: null,
        longitude: null,
        note: input.note || null,
        expectedCompletedAt: input.expectedCompletedAt,
        updatedAt: createdAt,
        lastOperatedByUserId: null,
        lastOperatedAt: null
      });
      return cloneSummary(summary);
    },

    async completeWish(id, image) {
      if (overrides.completeWish) {
        return overrides.completeWish(id, image);
      }

      const previous = requireSummary(summaries, id);
      const completedAt = now();
      const updated: WishSummaryDto = {
        ...previous,
        completed: true,
        completedAt,
        imageUrl: memoryImageUrl(image)
      };
      summaries.set(id, updated);
      updateMemoryDetail(details, updated, completedAt);
      return cloneSummary(updated);
    },

    async reopenWish(id) {
      if (overrides.reopenWish) {
        return overrides.reopenWish(id);
      }

      const previous = requireSummary(summaries, id);
      const operatedAt = now();
      const updated: WishSummaryDto = {
        ...previous,
        completed: false,
        completedAt: null
      };
      summaries.set(id, updated);
      updateMemoryDetail(details, updated, operatedAt);
      return cloneSummary(updated);
    }
  };
}

function requireSummary(
  summaries: Map<number, WishSummaryDto>,
  id: number
): WishSummaryDto {
  const summary = summaries.get(id);
  if (!summary) {
    throw new Error('清单不存在');
  }
  return summary;
}

function updateMemoryDetail(
  details: Map<number, WishDetailDto>,
  summary: WishSummaryDto,
  updatedAt: string
): void {
  const current = details.get(summary.id);
  details.set(summary.id, {
    ...(current ?? detailFromSummary(summary, updatedAt)),
    ...summary,
    updatedAt,
    lastOperatedAt: updatedAt
  });
}

function detailFromSummary(
  summary: WishSummaryDto,
  updatedAt: string
): WishDetailDto {
  return {
    ...cloneSummary(summary),
    description: '',
    locationName: null,
    latitude: null,
    longitude: null,
    note: null,
    expectedCompletedAt: null,
    updatedAt,
    lastOperatedByUserId: null,
    lastOperatedAt: null
  };
}

function cloneSummary(summary: WishSummaryDto): WishSummaryDto {
  return { ...summary };
}

function cloneDetail(detail: WishDetailDto): WishDetailDto {
  return { ...detail };
}

function memoryImageUrl(file: File): string {
  return `memory://wish-images/${encodeURIComponent(file.name)}`;
}

function compareSummaryOrder(
  left: WishSummaryDto,
  right: WishSummaryDto,
  completed: boolean
): number {
  const leftTime = completed ? left.completedAt ?? '' : left.createdAt;
  const rightTime = completed ? right.completedAt ?? '' : right.createdAt;
  if (leftTime !== rightTime) {
    return rightTime.localeCompare(leftTime);
  }
  return right.id - left.id;
}
