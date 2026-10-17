import angryIcon from './assets/moods/angry.webp';
import calmIcon from './assets/moods/calm.webp';
import expectingIcon from './assets/moods/expecting.webp';
import happyIcon from './assets/moods/happy.webp';
import missIcon from './assets/moods/miss.webp';
import secretIcon from './assets/moods/secret.webp';
import sweetIcon from './assets/moods/sweet.webp';
import tiredIcon from './assets/moods/tired.webp';
import touchedIcon from './assets/moods/touched.webp';
import wrongedIcon from './assets/moods/wronged.webp';
import type {
  DiaryMoodKey,
  DiaryMoodOption
} from './model';

export const DIARY_MOODS: DiaryMoodOption[] = [
  { key: 'happy', label: '开心', icon: happyIcon },
  { key: 'miss', label: '想念', icon: missIcon },
  { key: 'calm', label: '平静', icon: calmIcon },
  { key: 'wronged', label: '委屈', icon: wrongedIcon },
  { key: 'expecting', label: '期待', icon: expectingIcon },
  { key: 'tired', label: '疲惫', icon: tiredIcon },
  { key: 'sweet', label: '甜蜜', icon: sweetIcon },
  { key: 'secret', label: '秘密', icon: secretIcon },
  { key: 'angry', label: '生气', icon: angryIcon },
  { key: 'touched', label: '感动', icon: touchedIcon }
];

export const DIARY_MOOD_LABELS: Record<DiaryMoodKey, string> =
  Object.fromEntries(
    DIARY_MOODS.map((mood) => [mood.key, mood.label])
  ) as Record<DiaryMoodKey, string>;
