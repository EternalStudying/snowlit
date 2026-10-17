import type {
  WishCreateInput,
  WishDetailDto,
  WishPageDto,
  WishPageQuery,
  WishSummaryDto
} from '../model';

export interface WishGateway {
  fetchPage(query: WishPageQuery): Promise<WishPageDto>;
  fetchDetail(id: number): Promise<WishDetailDto>;
  createWish(input: WishCreateInput, image?: File): Promise<WishSummaryDto>;
  completeWish(id: number, image: File): Promise<WishSummaryDto>;
  reopenWish(id: number): Promise<WishSummaryDto>;
}
