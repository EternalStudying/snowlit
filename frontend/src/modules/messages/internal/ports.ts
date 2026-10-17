import type {
  MessageCreateInput,
  MessageEntry,
  MessagePageDto,
  MessagePageQuery
} from '../model';

export interface MessageGateway {
  fetchPage(query?: MessagePageQuery): Promise<MessagePageDto>;
  createMessage(
    input: MessageCreateInput,
    image?: File | null
  ): Promise<MessageEntry>;
  deleteMessage(id: number): Promise<void>;
}
