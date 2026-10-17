import type {
  HomeLocationSnapshot,
  HomeOverview
} from '../model';

export interface HomeGateway {
  fetchOverview(): Promise<HomeOverview>;
  reportLocation(snapshot: HomeLocationSnapshot): Promise<void>;
}
