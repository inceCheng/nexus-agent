import { describe, expect, it } from "vitest";

import {
  AgentRunnerService,
  type ChatModelFactory,
  normalizeGeneratedTitle,
} from "./agent-runner.service";

describe("AgentRunnerService title generation", () => {
  it("streams reasoning, tool, and skill traces before persisting assistant metadata", async () => {
    let persistedContent = "";
    let persistedMetadata: unknown;
    const modelFactory = (() => ({})) as unknown as ChatModelFactory;
    const agentFactory = (() => ({
      streamEvents: async () => ({
        messages: asyncIterable([
          {
            text: asyncIterable(["正文"]),
            reasoning: asyncIterable(["先分析用户意图"]),
          },
        ]),
        toolCalls: asyncIterable([
          {
            name: "read_file",
            callId: "tool_1",
            input: { path: "/tmp/demo.md" },
            output: Promise.resolve("文件内容"),
            status: Promise.resolve("finished"),
            error: Promise.resolve(undefined),
          },
        ]),
        subagents: asyncIterable([
          {
            name: "research",
            taskInput: Promise.resolve("查找项目上下文"),
            output: Promise.resolve({ summary: "已完成" }),
            messages: asyncIterable([]),
            toolCalls: asyncIterable([]),
            subagents: asyncIterable([]),
          },
        ]),
      }),
    })) as unknown as ConstructorParameters<typeof AgentRunnerService>[1];
    const service = new AgentRunnerService(modelFactory, agentFactory);

    const stream = service.createResponseStream({
      providerId: "openai",
      modelId: "gpt-5.2",
      apiKey: "sk-test",
      modelInfo: null,
      messages: [],
      onDone: async (content, metadataJson) => {
        persistedContent = content;
        persistedMetadata = metadataJson;
        return {
          id: "msg_1",
          conversationId: "conv_1",
          role: "assistant",
          content,
          status: "success",
          metadataJson,
          createdAt: new Date("2026-06-17T00:00:00.000Z"),
        };
      },
    });

    const body = await readStream(stream);

    expect(body).toContain("event: reasoning.delta");
    expect(body).toContain("event: tool.started");
    expect(body).toContain("event: tool.done");
    expect(body).toContain("event: skill.started");
    expect(body).toContain("event: skill.done");
    expect(body).toContain("event: message.done");
    expect(persistedContent).toBe("正文");
    expect(persistedMetadata).toMatchObject({
      traces: expect.arrayContaining([
        expect.objectContaining({
          kind: "reasoning",
          status: "success",
          content: "先分析用户意图",
        }),
        expect.objectContaining({
          kind: "tool",
          name: "read_file",
          status: "success",
        }),
        expect.objectContaining({
          kind: "skill",
          name: "research",
          status: "success",
        }),
      ]),
    });
  });

  it("asks the active chat model to generate a concise conversation title", async () => {
    const capturedMessages: unknown[] = [];
    const modelFactory = (() => ({
      invoke: async (messages: unknown[]) => {
        capturedMessages.push(...messages);
        return { content: '"DeepAgents 工作流"' };
      },
    })) as unknown as ChatModelFactory;
    const service = new AgentRunnerService(modelFactory);

    await expect(
      service.generateConversationTitle({
        providerId: "openai",
        modelId: "gpt-5.2",
        apiKey: "sk-test",
        modelInfo: null,
        userContent: "请帮我解释一下 DeepAgents 的工作流",
        assistantContent: "DeepAgents 可以把任务拆成计划、子任务和工具调用。",
      }),
    ).resolves.toBe("DeepAgents 工作流");

    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("只输出标题"),
    });
    expect(capturedMessages[1]).toMatchObject({
      role: "user",
      content: expect.stringContaining("请帮我解释一下 DeepAgents 的工作流"),
    });
  });

  it("normalizes generated titles into a single short line", () => {
    expect(normalizeGeneratedTitle("标题：**DeepAgents 工作流与工具调用**\n")).toBe(
      "DeepAgents 工作流与工具调用",
    );
    expect(normalizeGeneratedTitle("")).toBeNull();
  });
});

function asyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let body = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    body += decoder.decode(value, { stream: true });
  }

  return body;
}
