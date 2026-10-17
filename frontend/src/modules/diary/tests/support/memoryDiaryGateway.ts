import {
  deriveDiaryTitle,
  diaryMarkdownText,
  extractDiaryImageSources
} from '../../internal/markdown';
import type { DiaryGateway } from '../../internal/ports';
import type {
  DiaryArchiveDto,
  DiaryDetailDto,
  DiaryRole,
  DiarySummaryDto
} from '../../model';

export interface MemoryDiaryGatewayOptions {
  role?: DiaryRole;
  entries?: DiaryDetailDto[];
  now?: () => string;
  overrides?: Partial<DiaryGateway>;
}

export function createMemoryDiaryGateway({
  role = 'girlfriend',
  entries: initialEntries = [],
  now = () => new Date().toISOString(),
  overrides = {}
}: MemoryDiaryGatewayOptions = {}): DiaryGateway {
  const entries = new Map(
    initialEntries.map((entry) => [
      entry.id,
      cloneDetail(entry)
    ])
  );
  let nextId =
    Math.max(0, ...entries.keys()) + 1;

  return {
    async fetchCurrentRole() {
      return overrides.fetchCurrentRole
        ? overrides.fetchCurrentRole()
        : role;
    },

    async fetchArchive(year) {
      if (overrides.fetchArchive) {
        return overrides.fetchArchive(year);
      }
      return createArchive([...entries.values()], year);
    },

    async fetchMonth(month) {
      if (overrides.fetchMonth) {
        return overrides.fetchMonth(month);
      }
      return {
        month,
        items: [...entries.values()]
          .filter((entry) => entry.entryDate.startsWith(month))
          .sort(compareEntries)
          .map(toSummary)
      };
    },

    async fetchDetail(id) {
      if (overrides.fetchDetail) {
        return overrides.fetchDetail(id);
      }
      return cloneDetail(requireEntry(entries, id));
    },

    async createEntry(input) {
      if (overrides.createEntry) {
        return overrides.createEntry(input);
      }
      const timestamp = now();
      const content = input.contentMarkdown;
      const weather = input.weatherSnapshot;
      const detail: DiaryDetailDto = {
        id: nextId++,
        role,
        authorName:
          role === 'boyfriend' ? '伴侣 A' : '伴侣 B',
        authorAvatar: '',
        title: deriveDiaryTitle(content, ''),
        summary: diaryMarkdownText(content),
        imageUrls: extractDiaryImageSources(content),
        entryDate: input.date,
        moodKey: input.moodKey,
        locationName: weather?.locationName ?? '',
        weather: weather?.weather ?? '',
        visibility: input.visibility,
        createdAt: timestamp,
        updatedAt: timestamp,
        contentMarkdown: content,
        rawWeather: weather?.rawWeather ?? '',
        temperature: weather?.temperature ?? null,
        windDirection: weather?.windDirection ?? '',
        windPower: weather?.windPower ?? '',
        humidity: weather?.humidity ?? '',
        province: weather?.province ?? '',
        city: weather?.city ?? '',
        district: weather?.district ?? '',
        latitude: weather?.latitude ?? null,
        longitude: weather?.longitude ?? null
      };
      entries.set(detail.id, detail);
      return toSummary(detail);
    },

    async updateEntry(id, input) {
      if (overrides.updateEntry) {
        return overrides.updateEntry(id, input);
      }
      const previous = requireEntry(entries, id);
      const content = input.contentMarkdown;
      const updated: DiaryDetailDto = {
        ...previous,
        title: deriveDiaryTitle(content, previous.title),
        summary: diaryMarkdownText(content),
        imageUrls: extractDiaryImageSources(content),
        moodKey: input.moodKey,
        visibility: input.visibility,
        contentMarkdown: content,
        updatedAt: now()
      };
      entries.set(id, updated);
      return cloneDetail(updated);
    },

    async deleteEntry(id) {
      if (overrides.deleteEntry) {
        return overrides.deleteEntry(id);
      }
      if (!entries.delete(id)) {
        throw new Error('日记不存在');
      }
    },

    async uploadImage(file) {
      if (overrides.uploadImage) {
        return overrides.uploadImage(file);
      }
      return {
        uploadId: nextId++,
        url: `memory://diary-images/${encodeURIComponent(file.name)}`
      };
    }
  };
}

function createArchive(
  entries: DiaryDetailDto[],
  requestedYear?: number
): DiaryArchiveDto {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const month = entry.entryDate.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  });

  const years = [
    ...new Set(
      [...counts.keys()].map((month) =>
        Number(month.slice(0, 4))
      )
    )
  ]
    .filter(
      (year) =>
        requestedYear === undefined || year === requestedYear
    )
    .sort((left, right) => right - left)
    .map((year) => ({
      year,
      months: [...counts.entries()]
        .filter(([month]) =>
          month.startsWith(`${year}-`)
        )
        .sort(([left], [right]) =>
          left.localeCompare(right)
        )
        .map(([month, count]) => ({
          month,
          count,
          hasEntries: count > 0
        }))
    }));

  return { years };
}

function requireEntry(
  entries: Map<number, DiaryDetailDto>,
  id: number
): DiaryDetailDto {
  const entry = entries.get(id);
  if (!entry) {
    throw new Error('日记不存在');
  }
  return entry;
}

function toSummary(
  detail: DiaryDetailDto
): DiarySummaryDto {
  const {
    contentMarkdown: _contentMarkdown,
    rawWeather: _rawWeather,
    temperature: _temperature,
    windDirection: _windDirection,
    windPower: _windPower,
    humidity: _humidity,
    province: _province,
    city: _city,
    district: _district,
    latitude: _latitude,
    longitude: _longitude,
    ...summary
  } = detail;
  return { ...summary };
}

function cloneDetail(
  detail: DiaryDetailDto
): DiaryDetailDto {
  return {
    ...detail,
    imageUrls: [...detail.imageUrls]
  };
}

function compareEntries(
  left: DiaryDetailDto,
  right: DiaryDetailDto
): number {
  const dateOrder = right.entryDate.localeCompare(
    left.entryDate
  );
  return (
    dateOrder ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id - left.id
  );
}
