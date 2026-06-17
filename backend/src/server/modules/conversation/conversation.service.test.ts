import { describe, expect, it } from "vitest";

import { ConversationService } from "./conversation.service";
import type {
  ConversationRepository,
  MessageRepository,
} from "./conversation.repository";

describe("ConversationService", () => {
  it("creates a conversation with a default title and selected model", async () => {
    const conversationRepository: ConversationRepository = {
      findAll: async () => [],
      create: async (input) => ({
        id: "conv_1",
        title: input.title,
        providerId: input.providerId,
        modelId: input.modelId,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      updateTimestamp: async () => undefined,
      updateTitle: async (id, title) => ({
        id,
        title,
        providerId: "openai",
        modelId: "gpt-5.2",
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      delete: async () => undefined,
    };
    const messageRepository: MessageRepository = {
      findByConversationId: async () => [],
      create: async (input) => ({
        id: "msg_1",
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status,
        metadataJson: input.metadataJson ?? null,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    };

    const service = new ConversationService(
      conversationRepository,
      messageRepository,
    );

    await expect(
      service.createConversation({
        providerId: "openai",
        modelId: "gpt-5.2",
      }),
    ).resolves.toMatchObject({
      id: "conv_1",
      title: "新对话",
      providerId: "openai",
      modelId: "gpt-5.2",
    });
  });

  it("deletes the selected conversation", async () => {
    let deletedConversationId: string | undefined;
    const conversationRepository = {
      findAll: async () => [],
      create: async (input: {
        title: string;
        providerId: string;
        modelId: string;
      }) => ({
        id: "conv_1",
        title: input.title,
        providerId: input.providerId,
        modelId: input.modelId,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      updateTimestamp: async () => undefined,
      updateTitle: async (conversationId: string, title: string) => ({
        id: conversationId,
        title,
        providerId: "openai",
        modelId: "gpt-5.2",
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      delete: async (conversationId: string) => {
        deletedConversationId = conversationId;
      },
    } as ConversationRepository;
    const messageRepository: MessageRepository = {
      findByConversationId: async () => [],
      create: async (input) => ({
        id: "msg_1",
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status,
        metadataJson: input.metadataJson ?? null,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    };

    const service = new ConversationService(
      conversationRepository,
      messageRepository,
    );

    await service.deleteConversation("conv_1");

    expect(deletedConversationId).toBe("conv_1");
  });

  it("renames a conversation with a trimmed title", async () => {
    let renamedInput: { conversationId: string; title: string } | undefined;
    const conversationRepository = {
      findAll: async () => [],
      create: async (input: {
        title: string;
        providerId: string;
        modelId: string;
      }) => ({
        id: "conv_1",
        title: input.title,
        providerId: input.providerId,
        modelId: input.modelId,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      updateTimestamp: async () => undefined,
      delete: async () => undefined,
      updateTitle: async (conversationId: string, title: string) => {
        renamedInput = { conversationId, title };
        return {
          id: conversationId,
          title,
          providerId: "openai",
          modelId: "gpt-5.2",
          createdAt: new Date("2026-06-16T00:00:00.000Z"),
          updatedAt: new Date("2026-06-16T00:00:01.000Z"),
        };
      },
    } as ConversationRepository;
    const messageRepository: MessageRepository = {
      findByConversationId: async () => [],
      create: async (input) => ({
        id: "msg_1",
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status,
        metadataJson: input.metadataJson ?? null,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    };

    const service = new ConversationService(
      conversationRepository,
      messageRepository,
    );

    await expect(
      service.renameConversation("conv_1", { title: "  DeepAgents 入门  " }),
    ).resolves.toMatchObject({
      id: "conv_1",
      title: "DeepAgents 入门",
    });
    expect(renamedInput).toEqual({
      conversationId: "conv_1",
      title: "DeepAgents 入门",
    });
  });

  it("rejects empty conversation titles", async () => {
    const conversationRepository = {
      findAll: async () => [],
      create: async (input: {
        title: string;
        providerId: string;
        modelId: string;
      }) => ({
        id: "conv_1",
        title: input.title,
        providerId: input.providerId,
        modelId: input.modelId,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
        updatedAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
      updateTimestamp: async () => undefined,
      delete: async () => undefined,
      updateTitle: async () => {
        throw new Error("should not update");
      },
    } as ConversationRepository;
    const messageRepository: MessageRepository = {
      findByConversationId: async () => [],
      create: async (input) => ({
        id: "msg_1",
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status,
        metadataJson: input.metadataJson ?? null,
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    };

    const service = new ConversationService(
      conversationRepository,
      messageRepository,
    );

    await expect(
      service.renameConversation("conv_1", { title: "   " }),
    ).rejects.toThrow("conversation title is required");
  });
});
