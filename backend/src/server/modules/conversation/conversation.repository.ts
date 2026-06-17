export type ConversationDto = {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "local" | "loading" | "updating" | "success" | "error" | "abort";

export type MessageDto = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  metadataJson: unknown | null;
  createdAt: Date;
};

export interface ConversationRepository {
  findAll(): Promise<ConversationDto[]>;
  create(input: {
    title: string;
    providerId: string;
    modelId: string;
  }): Promise<ConversationDto>;
  updateTimestamp(id: string): Promise<void>;
  updateTitle(id: string, title: string): Promise<ConversationDto>;
  delete(id: string): Promise<void>;
}

export interface MessageRepository {
  findByConversationId(conversationId: string): Promise<MessageDto[]>;
  create(input: {
    conversationId: string;
    role: MessageRole;
    content: string;
    status: MessageStatus;
    metadataJson?: unknown;
  }): Promise<MessageDto>;
}
