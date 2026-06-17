import { createDeepAgent } from "deepagents";

import { encodeSseEvent } from "@/server/shared/sse";
import { publicErrorMessage } from "@/server/shared/route";

import type {
  ConversationDto,
  MessageDto,
} from "../conversation/conversation.repository";
import type { SupportedModel } from "../model-catalog/model-catalog.types";
import { createChatModel, type ModelRuntimeInput } from "./model-runtime";

export interface StreamAgentInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  modelInfo: SupportedModel | null;
  messages: MessageDto[];
  onDone: (content: string, metadataJson?: AgentMessageMetadata) => Promise<MessageDto>;
  onAfterDone?: (content: string) => Promise<ConversationDto | null>;
}

export type AgentTraceKind = "reasoning" | "tool" | "skill";
export type AgentTraceStatus = "running" | "success" | "error";

export interface AgentTraceEntry {
  id: string;
  kind: AgentTraceKind;
  title: string;
  status: AgentTraceStatus;
  name?: string;
  content?: string;
  input?: string;
  output?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessageMetadata {
  traces: AgentTraceEntry[];
}

export interface GenerateConversationTitleInput {
  providerId: string;
  modelId: string;
  apiKey: string;
  modelInfo: SupportedModel | null;
  userContent: string;
  assistantContent: string;
}

export type ChatModelFactory = typeof createChatModel;
export type DeepAgentFactory = typeof createDeepAgent;

export class AgentRunnerService {
  constructor(
    private readonly modelFactory: ChatModelFactory = createChatModel,
    private readonly agentFactory: DeepAgentFactory = createDeepAgent,
  ) {}

  createResponseStream(input: StreamAgentInput): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const modelFactory = this.modelFactory;
    const agentFactory = this.agentFactory;

    return new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        };

        let assistantContent = "";
        const traces = new Map<string, AgentTraceEntry>();

        try {
          const model = modelFactory({
            providerId: input.providerId,
            modelId: input.modelId,
            apiKey: input.apiKey,
            providerNpm: input.modelInfo?.providerNpm,
            apiBaseUrl: input.modelInfo?.apiBaseUrl,
          });

          const agent = agentFactory({
            model,
            systemPrompt:
              "You are NexusAgent, a concise assistant. Answer directly and preserve useful structure.",
          });

          const run = await agent.streamEvents(
            {
              messages: input.messages
                .filter((message) => message.role !== "system")
                .map((message) => ({
                  role: message.role,
                  content: message.content,
                })),
            },
            { version: "v3" },
          );

          await Promise.all([
            consumeMessageStreams(run.messages, {
              appendContent: (token) => {
                assistantContent += token;
                send("message.delta", { content: token });
              },
              updateTrace: (event, trace) =>
                updateTrace(traces, trace, (nextTrace) =>
                  send(event, { trace: nextTrace }),
                ),
            }),
            consumeToolCalls(run.toolCalls, {
              kind: "tool",
              startedEvent: "tool.started",
              doneEvent: "tool.done",
              updateTrace: (event, trace) =>
                updateTrace(traces, trace, (nextTrace) =>
                  send(event, { trace: nextTrace }),
                ),
            }),
            consumeSubagents(run.subagents, {
              updateTrace: (event, trace) =>
                updateTrace(traces, trace, (nextTrace) =>
                  send(event, { trace: nextTrace }),
                ),
            }),
          ]);

          const metadataJson =
            traces.size > 0 ? { traces: Array.from(traces.values()) } : undefined;
          const savedMessage = await input.onDone(
            assistantContent.trim(),
            metadataJson,
          );
          send("message.done", { message: serializeMessage(savedMessage) });

          if (input.onAfterDone) {
            const conversation = await input.onAfterDone(assistantContent.trim());

            if (conversation) {
              send("conversation.updated", {
                conversation: serializeConversation(conversation),
              });
            }
          }
        } catch (error) {
          send("error", { message: publicErrorMessage(error) });
        } finally {
          controller.close();
        }
      },
    });
  }

  async generateConversationTitle(
    input: GenerateConversationTitleInput,
  ): Promise<string> {
    const model = this.modelFactory(runtimeInputFromTitleInput(input));
    const response = await model.invoke([
      {
        role: "system",
        content:
          "你是对话标题生成器。根据用户问题和助手回答生成一个简洁中文标题。只输出标题，不要解释，不要标点包裹，不要超过 24 个汉字。",
      },
      {
        role: "user",
        content: `用户问题：${input.userContent}\n\n助手回答：${input.assistantContent}`,
      },
    ]);
    const title = normalizeGeneratedTitle(messageContentToText(response.content));

    return title ?? normalizeGeneratedTitle(input.userContent) ?? "新对话";
  }
}

export function serializeMessage(message: MessageDto) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

export function serializeConversation(conversation: ConversationDto) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function runtimeInputFromTitleInput(
  input: GenerateConversationTitleInput,
): ModelRuntimeInput {
  return {
    providerId: input.providerId,
    modelId: input.modelId,
    apiKey: input.apiKey,
    providerNpm: input.modelInfo?.providerNpm,
    apiBaseUrl: input.modelInfo?.apiBaseUrl,
  };
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          const text = record.text ?? record.content;

          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

export function normalizeGeneratedTitle(title: string): string | null {
  const normalized = title
    .replace(/\r?\n+/g, " ")
    .replace(/[*_`#>]/g, "")
    .trim()
    .replace(/^(标题|title)\s*[:：]\s*/i, "")
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const characters = Array.from(normalized);

  if (characters.length <= 36) {
    return normalized;
  }

  return characters.slice(0, 36).join("");
}

type TraceUpdate = Omit<AgentTraceEntry, "createdAt" | "updatedAt"> &
  Partial<Pick<AgentTraceEntry, "createdAt" | "updatedAt">>;

type TraceUpdater = (event: string, trace: TraceUpdate) => void;

async function consumeMessageStreams(
  messages: AsyncIterable<{
    text: AsyncIterable<string>;
    reasoning?: AsyncIterable<string>;
  }>,
  options: {
    appendContent: (token: string) => void;
    updateTrace: TraceUpdater;
  },
) {
  let reasoningIndex = 0;

  for await (const message of messages) {
    const reasoningId = `reasoning_${reasoningIndex++}`;
    let reasoningContent = "";

    await Promise.all([
      (async () => {
        for await (const token of message.text) {
          options.appendContent(token);
        }
      })(),
      (async () => {
        if (!message.reasoning) {
          return;
        }

        for await (const token of message.reasoning) {
          reasoningContent += token;
          options.updateTrace("reasoning.delta", {
            id: reasoningId,
            kind: "reasoning",
            title: "正在思考",
            status: "running",
            content: reasoningContent,
          });
        }

        if (reasoningContent) {
          options.updateTrace("reasoning.done", {
            id: reasoningId,
            kind: "reasoning",
            title: "思考",
            status: "success",
            content: reasoningContent,
          });
        }
      })(),
    ]);
  }
}

async function consumeToolCalls(
  toolCalls: AsyncIterable<{
    name: string;
    callId: string;
    input: unknown;
    output: Promise<unknown>;
    status: Promise<string>;
    error: Promise<string | undefined>;
  }>,
  options: {
    kind: "tool";
    startedEvent: "tool.started";
    doneEvent: "tool.done";
    updateTrace: TraceUpdater;
  },
) {
  const pending: Promise<void>[] = [];

  for await (const toolCall of toolCalls) {
    const id = toolCall.callId || `tool_${pending.length}`;
    const title = toolTitle(toolCall.name);

    options.updateTrace(options.startedEvent, {
      id,
      kind: options.kind,
      title,
      name: toolCall.name,
      status: "running",
      input: previewValue(toolCall.input),
    });

    pending.push(
      (async () => {
        const [status, output, error] = await resolveToolResult(toolCall);

        options.updateTrace(options.doneEvent, {
          id,
          kind: options.kind,
          title,
          name: toolCall.name,
          status: status === "error" ? "error" : "success",
          input: previewValue(toolCall.input),
          output: previewValue(output),
          error,
        });
      })(),
    );
  }

  await Promise.all(pending);
}

async function consumeSubagents(
  subagents: AsyncIterable<{
    name: string;
    taskInput: Promise<string>;
    output: Promise<unknown>;
  }>,
  options: {
    updateTrace: TraceUpdater;
  },
) {
  const pending: Promise<void>[] = [];

  for await (const subagent of subagents) {
    const id = `skill_${subagent.name}_${pending.length}`;
    const taskInput = await subagent.taskInput.catch((error: unknown) =>
      errorMessage(error),
    );

    options.updateTrace("skill.started", {
      id,
      kind: "skill",
      title: skillTitle(subagent.name),
      name: subagent.name,
      status: "running",
      input: previewValue(taskInput),
    });

    pending.push(
      (async () => {
        try {
          const output = await subagent.output;

          options.updateTrace("skill.done", {
            id,
            kind: "skill",
            title: skillTitle(subagent.name),
            name: subagent.name,
            status: "success",
            input: previewValue(taskInput),
            output: previewValue(output),
          });
        } catch (error) {
          options.updateTrace("skill.done", {
            id,
            kind: "skill",
            title: skillTitle(subagent.name),
            name: subagent.name,
            status: "error",
            input: previewValue(taskInput),
            error: errorMessage(error),
          });
        }
      })(),
    );
  }

  await Promise.all(pending);
}

function updateTrace(
  traces: Map<string, AgentTraceEntry>,
  trace: TraceUpdate,
  onUpdated: (trace: AgentTraceEntry) => void,
) {
  const now = new Date().toISOString();
  const current = traces.get(trace.id);
  const nextTrace: AgentTraceEntry = {
    ...current,
    ...trace,
    createdAt: trace.createdAt ?? current?.createdAt ?? now,
    updatedAt: trace.updatedAt ?? now,
  };

  traces.set(nextTrace.id, nextTrace);
  onUpdated(nextTrace);
}

async function resolveToolResult(toolCall: {
  output: Promise<unknown>;
  status: Promise<string>;
  error: Promise<string | undefined>;
}): Promise<[string, unknown, string | undefined]> {
  const status = await toolCall.status.catch(() => "error");

  if (status === "error") {
    const error = await toolCall.error.catch(errorMessage);
    return [status, undefined, error];
  }

  try {
    return [status, await toolCall.output, undefined];
  } catch (error) {
    return ["error", undefined, errorMessage(error)];
  }
}

function toolTitle(name: string): string {
  if (name === "write_todos") {
    return "更新计划";
  }

  if (name === "task") {
    return "Skill 调用";
  }

  return "工具调用";
}

function skillTitle(name: string): string {
  return name ? `Skill 调用 · ${name}` : "Skill 调用";
}

function previewValue(value: unknown, maxLength = 800): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value, (_key, nestedValue: unknown) =>
          typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
        );
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
