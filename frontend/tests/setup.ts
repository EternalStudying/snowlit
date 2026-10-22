import { vi } from 'vitest';
import { setInstantMotion } from '../src/motion';

// Tests check end states, not choreography.
setInstantMotion(true);

URL.createObjectURL = vi.fn(() => 'blob:fixture-photo');
URL.revokeObjectURL = vi.fn();
