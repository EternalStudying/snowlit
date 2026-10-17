import type { HomeGateway } from '../../internal/ports';
import type {
  HomeLocationSnapshot,
  HomeOverview
} from '../../model';

export interface MemoryHomeGatewayOptions {
  overview: HomeOverview;
  overrides?: Partial<HomeGateway>;
}

export function createMemoryHomeGateway({
  overview,
  overrides = {}
}: MemoryHomeGatewayOptions): HomeGateway {
  return {
    async fetchOverview() {
      return overrides.fetchOverview
        ? overrides.fetchOverview()
        : cloneOverview(overview);
    },

    async reportLocation(snapshot: HomeLocationSnapshot) {
      if (overrides.reportLocation) {
        return overrides.reportLocation(snapshot);
      }
    }
  };
}

function cloneOverview(overview: HomeOverview): HomeOverview {
  return structuredClone(overview);
}
