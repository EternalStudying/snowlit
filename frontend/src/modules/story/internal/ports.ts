import type {
  StoryImageUploadDto,
  StoryMoment,
  StoryMomentFilters,
  StoryMomentInput,
  StoryMomentListDto
} from '../model';

export interface StoryGateway {
  fetchMoments(filters?: StoryMomentFilters): Promise<StoryMomentListDto>;
  fetchMoment(id: number): Promise<StoryMoment>;
  createMoment(input: StoryMomentInput): Promise<StoryMoment>;
  updateMoment(id: number, input: StoryMomentInput): Promise<StoryMoment>;
  deleteMoment(id: number): Promise<void>;
  uploadImage(file: File): Promise<StoryImageUploadDto>;
}
