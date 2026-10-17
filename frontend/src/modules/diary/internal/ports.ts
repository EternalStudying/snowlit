import type {
  DiaryArchiveDto,
  DiaryCreateInput,
  DiaryDetailDto,
  DiaryImageUploadDto,
  DiaryMonthDto,
  DiaryRole,
  DiarySummaryDto,
  DiaryUpdateInput
} from '../model';

export interface DiaryGateway {
  fetchCurrentRole(): Promise<DiaryRole>;
  fetchArchive(year?: number): Promise<DiaryArchiveDto>;
  fetchMonth(month: string): Promise<DiaryMonthDto>;
  fetchDetail(id: number): Promise<DiaryDetailDto>;
  createEntry(input: DiaryCreateInput): Promise<DiarySummaryDto>;
  updateEntry(id: number, input: DiaryUpdateInput): Promise<DiaryDetailDto>;
  deleteEntry(id: number): Promise<void>;
  uploadImage(file: File): Promise<DiaryImageUploadDto>;
}
