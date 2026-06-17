import { BadRequestError } from "@/server/shared/errors";

import type {
  ConversationDto,
  ConversationRepository,
  MessageDto,
  MessageRepository,
  MessageRole,
  MessageStatus,
} from "./conversation.repository";

export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  listConversations(): Promise<ConversationDto[]> {
    return this.conversationRepository.findAll();
  }

  listMessages(conversationId: string): Promise<MessageDto[]> {
    return this.messageRepository.findByConversationId(conversationId);
  }

  createConversation(input: {
    title?: string;
    providerId: string;
    modelId: string;
  }): Promise<ConversationDto> {
    const providerId = input.providerId.trim();
    const modelId = input.modelId.trim();

    if (!providerId || !modelId) {
      throw new BadRequestError("providerId and modelId are required");
    }

    return this.conversationRepository.create({
      title: input.title?.trim() || "新对话",
      providerId,
      modelId,
    });
  }

  deleteConversation(conversationId: string): Promise<void> {
    const id = conversationId.trim();

    if (!id) {
      throw new BadRequestError("conversationId is required");
    }

    return this.conversationRepository.delete(id);
  }

  async appendMessage(input: {
    conversationId: string;
    role: MessageRole;
    content: string;
    status?: MessageStatus;
    metadataJson?: unknown;
  }): Promise<MessageDto> {
    const content = input.content.trim();

    if (!input.conversationId.trim()) {
      throw new BadRequestError("conversationId is required");
    }

    if (!content) {
      throw new BadRequestError("message content is required");
    }

    const message = await this.messageRepository.create({
      conversationId: input.conversationId,
      role: input.role,
      content,
      status: input.status ?? "success",
      metadataJson: input.metadataJson,
    });

    await this.conversationRepository.updateTimestamp(input.conversationId);

    return message;
  }
}
