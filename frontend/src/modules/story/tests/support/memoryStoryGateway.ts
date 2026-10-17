import type { StoryGateway } from '../../internal/ports';
import type {
  StoryMoment,
  StoryMomentFilters,
  StoryMomentInput
} from '../../model';

export interface MemoryStoryGatewayOptions {
  moments?: StoryMoment[];
  canManage?: boolean;
  now?: () => string;
  overrides?: Partial<StoryGateway>;
}

export function createMemoryStoryGateway({
  moments: initialMoments = [],
  canManage = false,
  now = () => new Date().toISOString(),
  overrides = {}
}: MemoryStoryGatewayOptions = {}): StoryGateway {
  const moments = new Map(
    initialMoments.map((moment) => [
      moment.id,
      cloneMoment(moment)
    ])
  );
  let nextId = Math.max(0, ...moments.keys()) + 1;

  return {
    async fetchMoments(filters = {}) {
      if (overrides.fetchMoments) {
        return overrides.fetchMoments(filters);
      }
      const items = [...moments.values()]
        .filter((moment) => matchesFilters(moment, filters))
        .sort(
          (left, right) =>
            new Date(right.eventTime).getTime() -
            new Date(left.eventTime).getTime()
        )
        .map(cloneMoment);
      const years = [
        ...new Set(
          [...moments.values()].map((moment) =>
            new Date(moment.eventTime).getFullYear()
          )
        )
      ]
        .filter(Number.isFinite)
        .sort((left, right) => right - left);
      return { items, years, canManage };
    },

    async fetchMoment(id) {
      if (overrides.fetchMoment) {
        return overrides.fetchMoment(id);
      }
      return cloneMoment(requireMoment(moments, id));
    },

    async createMoment(input) {
      if (overrides.createMoment) {
        return overrides.createMoment(input);
      }
      const timestamp = now();
      const moment: StoryMoment = {
        id: nextId++,
        ...cloneInput(input),
        createdByUserId: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      moments.set(moment.id, moment);
      return cloneMoment(moment);
    },

    async updateMoment(id, input) {
      if (overrides.updateMoment) {
        return overrides.updateMoment(id, input);
      }
      const previous = requireMoment(moments, id);
      const updated: StoryMoment = {
        ...previous,
        ...cloneInput(input),
        updatedAt: now()
      };
      moments.set(id, updated);
      return cloneMoment(updated);
    },

    async deleteMoment(id) {
      if (overrides.deleteMoment) {
        return overrides.deleteMoment(id);
      }
      if (!moments.delete(id)) {
        throw new Error('点滴不存在');
      }
    },

    async uploadImage(file) {
      if (overrides.uploadImage) {
        return overrides.uploadImage(file);
      }
      return {
        url: `memory://story-images/${encodeURIComponent(file.name)}`
      };
    }
  };
}

function matchesFilters(
  moment: StoryMoment,
  filters: StoryMomentFilters
): boolean {
  return (
    (!filters.category || moment.category === filters.category) &&
    (filters.year === undefined ||
      new Date(moment.eventTime).getFullYear() === filters.year)
  );
}

function requireMoment(
  moments: Map<number, StoryMoment>,
  id: number
): StoryMoment {
  const moment = moments.get(id);
  if (!moment) {
    throw new Error('点滴不存在');
  }
  return moment;
}

function cloneMoment(moment: StoryMoment): StoryMoment {
  return {
    ...moment,
    images: [...moment.images]
  };
}

function cloneInput(input: StoryMomentInput): StoryMomentInput {
  return {
    ...input,
    images: [...input.images]
  };
}
