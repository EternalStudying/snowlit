import type {
  DiaryMoodKey,
  DiaryMoodOption
} from './model';

export const DIARY_MOODS: DiaryMoodOption[] = [
  { key: 'happy', label: '开心' },
  { key: 'miss', label: '想念' },
  { key: 'calm', label: '平静' },
  { key: 'wronged', label: '委屈' },
  { key: 'expecting', label: '期待' },
  { key: 'tired', label: '疲惫' },
  { key: 'sweet', label: '甜蜜' },
  { key: 'secret', label: '秘密' },
  { key: 'angry', label: '生气' },
  { key: 'touched', label: '感动' }
];

export const DIARY_MOOD_LABELS: Record<DiaryMoodKey, string> =
  Object.fromEntries(
    DIARY_MOODS.map((mood) => [mood.key, mood.label])
  ) as Record<DiaryMoodKey, string>;
