import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/shared/prisma";

import type {
  ConversationDto,
  ConversationRepository,
  MessageDto,
  MessageRepository,
} from "./conversation.repository";

const conversationOrder = [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }];
const messageOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

export class PrismaConversationRepository implements ConversationRepository {
  async findAll(): Promise<ConversationDto[]> {
    return prisma.conversation.findMany({
      orderBy: conversationOrder,
    });
  }

  async create(input: {
    title: string;
    providerId: string;
    modelId: string;
  }): Promise<ConversationDto> {
    return prisma.conversation.create({
      data: input,
    });
  }

  async updateTimestamp(id: string): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.conversation.deleteMany({
      where: { id },
    });
  }
}

export class PrismaMessageRepository implements MessageRepository {
  async findByConversationId(conversationId: string): Promise<MessageDto[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: messageOrder,
    });
  }

  async create(input: {
    conversationId: string;
    role: MessageDto["role"];
    content: string;
    status: MessageDto["status"];
    metadataJson?: unknown;
  }): Promise<MessageDto> {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status,
        metadataJson:
          input.metadataJson === undefined
            ? undefined
            : (input.metadataJson as Prisma.InputJsonValue),
      },
    });
  }
}
