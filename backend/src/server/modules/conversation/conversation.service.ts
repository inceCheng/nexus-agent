import { BadRequestError } from "@/server/shared/errors";

import type {
  ConversationDto,
  ConversationRepository,
  MessageDto,
  MessageRepository,
  MessageRole,
  MessageStatus,
} from "./conversation.repository";

export const DEFAULT_CONVERSATION_TITLE = "新对话";

const maxConversationTitleLength = 60;

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
      title: input.title?.trim() || DEFAULT_CONVERSATION_TITLE,
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

  async renameConversation(
    conversationId: string,
    input: { title: string },
  ): Promise<ConversationDto> {
    const id = conversationId.trim();
    const title = input.title.trim();

    if (!id) {
      throw new BadRequestError("conversationId is required");
    }

    if (!title) {
      throw new BadRequestError("conversation title is required");
    }

    return this.conversationRepository.updateTitle(
      id,
      limitTitleLength(title, maxConversationTitleLength),
    );
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

function limitTitleLength(title: string, maxLength: number): string {
  const characters = Array.from(title);

  if (characters.length <= maxLength) {
    return title;
  }

  return `${characters.slice(0, maxLength).join("")}...`;
}
