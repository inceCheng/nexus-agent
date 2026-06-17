"use client";

import {
  BranchesOutlined,
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Bubble, Conversations, Sender, XProvider } from "@ant-design/x";
import {
  App,
  Avatar,
  Button,
  ConfigProvider,
  Divider,
  Empty,
  Input,
  Popover,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./nexus-workspace.module.css";

type ProviderOption = {
  id: string;
  name: string;
  apiBaseUrl: string | null;
  providerNpm: string | null;
  envNames: string[];
};

type ModelOption = {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  providerNpm: string | null;
  apiBaseUrl: string | null;
  contextLimit: number | null;
  family: string | null;
  toolCall: boolean;
  status: string;
};

type Conversation = {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "local" | "loading" | "updating" | "success" | "error" | "abort";
  metadataJson?: AgentMessageMetadata | null;
  createdAt: string;
};

type AgentTraceKind = "reasoning" | "tool" | "skill";
type AgentTraceStatus = "running" | "success" | "error";

type AgentTraceEntry = {
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
};

type AgentMessageMetadata = {
  traces?: AgentTraceEntry[];
};

type BubbleItem = NonNullable<
  React.ComponentProps<typeof Bubble.List>["items"]
>[number];

const bubbleRoles = {
  assistant: {
    placement: "start",
    variant: "filled",
    shape: "corner",
    typing: { effect: "typing", step: 2, interval: 18, keepPrefix: true },
  },
  user: {
    placement: "end",
    variant: "filled",
    shape: "corner",
  },
} satisfies React.ComponentProps<typeof Bubble.List>["role"];

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);

export function NexusWorkspace() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2453d4",
          colorInfo: "#08756f",
          colorBgLayout: "#f7f8fa",
          colorBorder: "#d9dee7",
          borderRadius: 6,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
      }}
    >
      <App>
        <XProvider>
          <WorkspaceShell />
        </XProvider>
      </App>
    </ConfigProvider>
  );
}

function WorkspaceShell() {
  const { message } = App.useApp();
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [providerId, setProviderId] = useState<string>();
  const [modelId, setModelId] = useState<string>();
  const [apiKey, setApiKey] = useState("");
  const [settingsProviderId, setSettingsProviderId] = useState<string>();
  const [settingsModelId, setSettingsModelId] = useState<string>();
  const [settingsApiKey, setSettingsApiKey] = useState("");
  const [settingsModels, setSettingsModels] = useState<ModelOption[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [settingsModelsLoading, setSettingsModelsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingConversationId, setRenamingConversationId] =
    useState<string>();
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const assistantMessageIdRef = useRef<string | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ),
    [activeConversationId, conversations],
  );

  const selectedProvider = providers.find(
    (provider) => provider.id === providerId,
  );
  const selectedModel = models.find((model) => model.id === modelId);
  const selectedSettingsProvider = providers.find(
    (provider) => provider.id === settingsProviderId,
  );
  const selectedSettingsModel = settingsModels.find(
    (model) => model.id === settingsModelId,
  );

  const loadProviders = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const data = await apiGet<{ providers: ProviderOption[] }>(
        "/api/models/providers",
      );
      setProviders(data.providers);
      setProviderId((current) => current ?? data.providers[0]?.id);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setCatalogLoading(false);
    }
  }, [message]);

  const fetchModels = useCallback(async (nextProviderId: string) => {
    const data = await apiGet<{ models: ModelOption[] }>(
      `/api/models/providers/${encodeURIComponent(nextProviderId)}/models`,
    );
    return data.models;
  }, []);

  const loadModels = useCallback(async (nextProviderId: string) => {
    const nextModels = await fetchModels(nextProviderId);
    setModels(nextModels);
    setModelId((current) => {
      if (current && nextModels.some((model) => model.id === current)) {
        return current;
      }
      return nextModels[0]?.id;
    });
  }, [fetchModels]);

  const loadSettingsModels = useCallback(
    async (nextProviderId: string, preferredModelId?: string) => {
      setSettingsModelsLoading(true);
      try {
        const nextModels = await fetchModels(nextProviderId);
        setSettingsModels(nextModels);
        setSettingsModelId((current) => {
          const candidate = preferredModelId ?? current;

          if (candidate && nextModels.some((model) => model.id === candidate)) {
            return candidate;
          }

          return nextModels[0]?.id;
        });
      } catch (error) {
        message.error(errorMessage(error));
      } finally {
        setSettingsModelsLoading(false);
      }
    },
    [fetchModels, message],
  );

  const loadConversations = useCallback(async () => {
    const data = await apiGet<{ conversations: Conversation[] }>(
      "/api/conversations",
    );
    setConversations(data.conversations);
    setActiveConversationId((current) => current ?? data.conversations[0]?.id);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const data = await apiGet<{ messages: ChatMessage[] }>(
      `/api/conversations/${conversationId}/messages`,
    );
    setMessages(data.messages);
  }, []);

  const updateConversationState = useCallback((conversation: Conversation) => {
    setConversations((current) => {
      if (current.some((item) => item.id === conversation.id)) {
        return current.map((item) =>
          item.id === conversation.id ? conversation : item,
        );
      }

      return [conversation, ...current];
    });
  }, []);

  useEffect(() => {
    void loadProviders();
    void loadConversations();
  }, [loadConversations, loadProviders]);

  useEffect(() => {
    if (!providerId) {
      return;
    }

    loadModels(providerId).catch((error) => message.error(errorMessage(error)));
  }, [loadModels, message, providerId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(activeConversationId).catch((error) =>
      message.error(errorMessage(error)),
    );
  }, [activeConversationId, loadMessages, message]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    setSettingsProviderId(providerId);
    setSettingsModelId(modelId);
    setSettingsApiKey(apiKey);

    if (providerId) {
      void loadSettingsModels(providerId, modelId);
    } else {
      setSettingsModels([]);
    }
  }, [apiKey, loadSettingsModels, modelId, providerId, settingsOpen]);

  const createConversation = useCallback(async () => {
    if (!providerId || !modelId) {
      message.warning("先选择模型");
      return undefined;
    }

    const data = await apiPost<{ conversation: Conversation }>(
      "/api/conversations",
      {
        providerId,
        modelId,
      },
    );

    setConversations((current) => [data.conversation, ...current]);
    setActiveConversationId(data.conversation.id);
    setMessages([]);
    return data.conversation;
  }, [message, modelId, providerId]);

  const ensureConversation = useCallback(async () => {
    if (activeConversationId) {
      return activeConversationId;
    }

    const conversation = await createConversation();
    return conversation?.id;
  }, [activeConversationId, createConversation]);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (loading) {
        message.warning("消息生成中，稍后删除");
        return;
      }

      try {
        await apiDelete(
          `/api/conversations/${encodeURIComponent(conversationId)}`,
        );
        const nextConversations = conversations.filter(
          (conversation) => conversation.id !== conversationId,
        );

        setConversations(nextConversations);

        if (activeConversationId === conversationId) {
          const nextActiveId = nextConversations[0]?.id;
          setActiveConversationId(nextActiveId);

          if (!nextActiveId) {
            setMessages([]);
          }
        }

        message.success("已删除对话");
      } catch (error) {
        message.error(errorMessage(error));
      }
    },
    [activeConversationId, conversations, loading, message],
  );

  const beginRenameConversation = useCallback((conversation: Conversation) => {
    setRenamingConversationId(conversation.id);
    setRenameDraft(conversation.title);
  }, []);

  const cancelRenameConversation = useCallback(() => {
    setRenamingConversationId(undefined);
    setRenameDraft("");
  }, []);

  const renameConversation = useCallback(
    async (conversationId: string) => {
      const title = renameDraft.trim();

      if (!title) {
        message.warning("请输入会话标题");
        return;
      }

      setRenaming(true);

      try {
        const data = await apiPatch<{ conversation: Conversation }>(
          `/api/conversations/${encodeURIComponent(conversationId)}`,
          { title },
        );
        updateConversationState(data.conversation);
        cancelRenameConversation();
        message.success("已重命名对话");
      } catch (error) {
        message.error(errorMessage(error));
      } finally {
        setRenaming(false);
      }
    },
    [cancelRenameConversation, message, renameDraft, updateConversationState],
  );

  const applySettings = useCallback(() => {
    if (!settingsProviderId || !settingsModelId) {
      message.warning("先选择模型");
      return;
    }

    setProviderId(settingsProviderId);
    setModelId(settingsModelId);
    setApiKey(settingsApiKey);

    if (settingsModels.length > 0) {
      setModels(settingsModels);
    }

    setSettingsOpen(false);
    message.success("模型设置已更新");
  }, [
    message,
    settingsApiKey,
    settingsModelId,
    settingsModels,
    settingsProviderId,
  ]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (!trimmed || loading) {
        return;
      }

      if (!providerId || !modelId) {
        message.warning("先选择模型");
        return;
      }

      if (!apiKey.trim()) {
        message.warning("请输入 API key");
        return;
      }

      setLoading(true);

      try {
        const conversationId = await ensureConversation();

        if (!conversationId) {
          return;
        }

        const userMessage: ChatMessage = {
          id: `local-user-${Date.now()}`,
          conversationId,
          role: "user",
          content: trimmed,
          status: "local",
          createdAt: new Date().toISOString(),
        };
        const assistantMessage: ChatMessage = {
          id: `local-assistant-${Date.now()}`,
          conversationId,
          role: "assistant",
          content: "",
          status: "updating",
          metadataJson: { traces: [] },
          createdAt: new Date().toISOString(),
        };

        assistantMessageIdRef.current = assistantMessage.id;
        setMessages((current) => [...current, userMessage, assistantMessage]);
        setDraft("");

        const response = await fetch(
          apiUrl(`/api/conversations/${conversationId}/messages/stream`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: trimmed,
              providerId,
              modelId,
              apiKey,
            }),
          },
        );

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(errorBody?.error ?? "发送失败");
        }

        await readSse(response, {
          onEvent(event, data) {
            if (event === "message.delta") {
              const delta = String(data.content ?? "");
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessageIdRef.current
                    ? {
                        ...item,
                        content: item.content + delta,
                        status: "updating",
                      }
                    : item,
                ),
              );
            }

            if (isTraceStreamEvent(event)) {
              const trace = data.trace as AgentTraceEntry | undefined;

              if (trace) {
                setMessages((current) =>
                  current.map((item) =>
                    item.id === assistantMessageIdRef.current
                      ? mergeMessageTrace(item, trace)
                      : item,
                  ),
                );
              }
            }

            if (event === "message.done") {
              const saved = data.message as ChatMessage;
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessageIdRef.current
                    ? mergeSavedAssistantMessage(item, saved)
                    : item,
                ),
              );
              void loadConversations();
            }

            if (event === "conversation.updated") {
              updateConversationState(data.conversation as Conversation);
            }

            if (event === "error") {
              throw new Error(String(data.message ?? "模型调用失败"));
            }
          },
        });
      } catch (error) {
        message.error(errorMessage(error));
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageIdRef.current
              ? {
                  ...item,
                  status: "error",
                  content: item.content || errorMessage(error),
                }
              : item,
          ),
        );
      } finally {
        setLoading(false);
        assistantMessageIdRef.current = null;
      }
    },
    [
      apiKey,
      ensureConversation,
      loadConversations,
      loading,
      message,
      modelId,
      providerId,
      updateConversationState,
    ],
  );

  const conversationItems = conversations.map((conversation) => ({
    key: conversation.id,
    label: (
      renamingConversationId === conversation.id ? (
        <div
          className={styles.conversationRename}
          onClick={(event) => event.stopPropagation()}
        >
          <Input
            size="small"
            className={styles.conversationRenameInput}
            value={renameDraft}
            autoFocus
            disabled={renaming}
            onChange={(event) => setRenameDraft(event.target.value)}
            onPressEnter={() => void renameConversation(conversation.id)}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === "Escape") {
                cancelRenameConversation();
              }
            }}
          />
          <div className={styles.conversationRenameActions}>
            <button
              className={styles.conversationRenameButton}
              type="button"
              aria-label="保存会话标题"
              title="保存"
              disabled={renaming}
              onClick={(event) => {
                event.stopPropagation();
                void renameConversation(conversation.id);
              }}
            >
              <CheckOutlined />
            </button>
            <button
              className={styles.conversationRenameButton}
              type="button"
              aria-label="取消重命名"
              title="取消"
              disabled={renaming}
              onClick={(event) => {
                event.stopPropagation();
                cancelRenameConversation();
              }}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.conversationItem}>
          <span className={styles.conversationTitle}>{conversation.title}</span>
          <div className={styles.conversationActions}>
            <button
              className={styles.conversationEdit}
              type="button"
              aria-label={`重命名对话 ${conversation.title}`}
              title="重命名"
              onClick={(event) => {
                event.stopPropagation();
                beginRenameConversation(conversation);
              }}
            >
              <EditOutlined />
            </button>
            <Popconfirm
              title="删除对话"
              description="删除后会同时移除历史消息。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={(event) => {
                event?.stopPropagation();
                void deleteConversation(conversation.id);
              }}
            >
              <button
                className={styles.conversationDelete}
                type="button"
                aria-label={`删除对话 ${conversation.title}`}
                title="删除"
                onClick={(event) => event.stopPropagation()}
              >
                <DeleteOutlined />
              </button>
            </Popconfirm>
          </div>
        </div>
      )
    ),
    group: groupConversation(conversation.updatedAt),
  }));

  const bubbleItems: BubbleItem[] = messages.map((item) => ({
    key: item.id,
    role: item.role === "assistant" ? "assistant" : "user",
    content: item.content,
    classNames:
      item.role === "assistant"
        ? { content: styles.assistantText }
        : undefined,
    status: item.status,
    streaming: item.status === "updating",
    loading: item.status === "loading",
    header:
      item.role === "assistant" ? (
        <AssistantMessageHeader
          title={selectedModel?.name ?? activeConversation?.modelId ?? "Assistant"}
          traces={traceTimeline(item.metadataJson)}
          streaming={item.status === "updating"}
        />
      ) : (
        "You"
      ),
  }));

  const runtimeMapped = isRuntimeMapped(selectedProvider, selectedModel);
  const settingsRuntimeMapped = isRuntimeMapped(
    selectedSettingsProvider,
    selectedSettingsModel,
  );
  const settingsDirty =
    settingsProviderId !== providerId ||
    settingsModelId !== modelId ||
    settingsApiKey !== apiKey;

  const settingsContent = (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <div>
          <Typography.Text className={styles.settingsTitle}>
            模型设置
          </Typography.Text>
          <Typography.Text className={styles.settingsMeta}>
            确认后对后续请求生效
          </Typography.Text>
        </div>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={catalogLoading}
          onClick={() => {
            void loadProviders();
            if (settingsProviderId) {
              void loadSettingsModels(settingsProviderId, settingsModelId);
            }
            if (activeConversationId) {
              void loadMessages(activeConversationId);
            }
          }}
        />
      </div>

      <Divider className={styles.settingsDivider} />

      <label className={styles.settingsField}>
        <span>Provider</span>
        <Select
          showSearch
          className={styles.settingsSelect}
          value={settingsProviderId}
          loading={catalogLoading}
          options={providers.map((provider) => ({
            value: provider.id,
            label: provider.name,
            searchLabel: `${provider.name} ${provider.id}`,
          }))}
          onChange={(value) => {
            setSettingsProviderId(value);
            setSettingsModelId(undefined);
            void loadSettingsModels(value);
          }}
          optionFilterProp="searchLabel"
          placeholder="Provider"
        />
      </label>

      <label className={styles.settingsField}>
        <span>Model</span>
        <Select
          showSearch
          className={styles.settingsSelect}
          value={settingsModelId}
          loading={settingsModelsLoading}
          options={settingsModels.map((model) => ({
            value: model.id,
            label: model.name,
            searchLabel: `${model.name} ${model.id} ${model.family ?? ""}`,
          }))}
          onChange={setSettingsModelId}
          optionFilterProp="searchLabel"
          placeholder="Model"
        />
      </label>

      <label className={styles.settingsField}>
        <span>API key</span>
        <Input.Password
          prefix={<KeyOutlined />}
          value={settingsApiKey}
          onChange={(event) => setSettingsApiKey(event.target.value)}
          placeholder={selectedSettingsProvider?.envNames?.[0] ?? "API key"}
          autoComplete="off"
        />
      </label>

      <div className={styles.settingsTags}>
        <Tag color={settingsRuntimeMapped ? "green" : "orange"}>
          {settingsRuntimeMapped ? "LangChain 可调用" : "仅目录配置"}
        </Tag>
        {selectedSettingsModel ? (
          <Tag color={selectedSettingsModel.toolCall ? "blue" : "default"}>
            {selectedSettingsModel.toolCall ? "tool_call" : "no tool_call"}
          </Tag>
        ) : null}
        {selectedSettingsModel?.status ? (
          <Tag>{selectedSettingsModel.status}</Tag>
        ) : null}
        {settingsDirty ? <Tag color="gold">待确认</Tag> : null}
      </div>

      <div className={styles.settingsActions}>
        <Button onClick={() => setSettingsOpen(false)}>取消</Button>
        <Button
          type="primary"
          disabled={!settingsProviderId || !settingsModelId || !settingsDirty}
          onClick={applySettings}
        >
          确认
        </Button>
      </div>
    </div>
  );

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandMark}>NX</div>
          <div>
            <Typography.Title level={1} className={styles.brandTitle}>
              NexusAgent
            </Typography.Title>
            <Typography.Text className={styles.brandSub}>
              DeepAgents workspace
            </Typography.Text>
          </div>
        </div>

        <Conversations
          className={styles.conversationList}
          items={conversationItems}
          activeKey={activeConversationId}
          onActiveChange={(key) => setActiveConversationId(key)}
          groupable={{
            label: (group) => group,
          }}
          creation={{
            label: "新对话",
            onClick: () =>
              createConversation().catch((error) =>
                message.error(errorMessage(error)),
              ),
          }}
        />

        <Popover
          trigger="click"
          placement="rightBottom"
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          content={settingsContent}
        >
          <button className={styles.profileButton} type="button">
            <Avatar icon={<UserOutlined />} className={styles.profileAvatar} />
            <div className={styles.profileText}>
              <span>{selectedProvider?.name ?? "Provider"}</span>
              <small>{selectedModel?.name ?? modelId ?? "Model"}</small>
            </div>
            <SettingOutlined className={styles.profileIcon} />
          </button>
        </Popover>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.toolbar}>
          <div className={styles.sessionTitle}>
            <RobotOutlined />
            <div className={styles.titleBlock}>
              {activeConversation &&
              renamingConversationId === activeConversation.id ? (
                <div className={styles.titleRename}>
                  <Input
                    className={styles.titleRenameInput}
                    value={renameDraft}
                    autoFocus
                    disabled={renaming}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onPressEnter={() =>
                      void renameConversation(activeConversation.id)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        cancelRenameConversation();
                      }
                    }}
                  />
                  <button
                    className={styles.titleRenameButton}
                    type="button"
                    aria-label="保存会话标题"
                    title="保存"
                    disabled={renaming}
                    onClick={() => void renameConversation(activeConversation.id)}
                  >
                    <CheckOutlined />
                  </button>
                  <button
                    className={styles.titleRenameButton}
                    type="button"
                    aria-label="取消重命名"
                    title="取消"
                    disabled={renaming}
                    onClick={cancelRenameConversation}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ) : (
                <div className={styles.titleRow}>
                  <Typography.Title level={2} className={styles.chatTitle}>
                    {activeConversation?.title ?? "新对话"}
                  </Typography.Title>
                  {activeConversation ? (
                    <button
                      className={styles.titleEditButton}
                      type="button"
                      aria-label="重命名当前会话"
                      title="重命名"
                      onClick={() => beginRenameConversation(activeConversation)}
                    >
                      <EditOutlined />
                    </button>
                  ) : null}
                </div>
              )}
              <Typography.Text className={styles.chatMeta}>
                {selectedProvider?.name ?? "Provider"} ·{" "}
                {selectedModel?.name ?? "Model"}
              </Typography.Text>
            </div>
          </div>

          <Space wrap className={styles.toolbarStatus}>
            <Tag color={runtimeMapped ? "green" : "orange"}>
              {runtimeMapped ? "runtime" : "catalog"}
            </Tag>
            {selectedModel?.contextLimit ? (
              <Tag color="gold">
                {Intl.NumberFormat("en", { notation: "compact" }).format(
                  selectedModel.contextLimit,
                )}{" "}
                ctx
              </Tag>
            ) : null}
          </Space>
        </header>

        <div className={styles.modelRail}>
          <Tag color="blue">{providerId ?? "provider"}</Tag>
          <Tag color="cyan">{modelId ?? "model"}</Tag>
          {selectedModel?.contextLimit ? (
            <Tag color="gold">
              {Intl.NumberFormat("en", { notation: "compact" }).format(
                selectedModel.contextLimit,
              )}{" "}
              ctx
            </Tag>
          ) : null}
        </div>

        <div className={styles.messages}>
          {bubbleItems.length > 0 ? (
            <Bubble.List
              className={styles.bubbleList}
              items={bubbleItems}
              role={bubbleRoles}
              autoScroll
            />
          ) : (
            <Empty
              className={styles.empty}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="选择模型后开始对话"
            />
          )}
        </div>

        <div className={styles.senderBar}>
          <div className={styles.composerShell}>
            <Sender
              className={styles.sender}
              value={draft}
              loading={loading}
              disabled={!providerId || !modelId}
              placeholder="输入消息，按 Enter 发送"
              autoSize={{ minRows: 2, maxRows: 5 }}
              submitType="enter"
              onChange={(value) => setDraft(value)}
              onSubmit={(value) => void sendMessage(value)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function AssistantMessageHeader({
  title,
  traces,
  streaming,
}: {
  title: string;
  traces: AgentTraceEntry[];
  streaming: boolean;
}) {
  return (
    <div className={styles.assistantHeader}>
      <span className={styles.assistantHeaderLabel}>{title}</span>
      <TraceTimeline traces={traces} streaming={streaming} />
    </div>
  );
}

function TraceTimeline({
  traces,
  streaming,
}: {
  traces: AgentTraceEntry[];
  streaming: boolean;
}) {
  if (traces.length === 0) {
    return null;
  }

  return (
    <div className={styles.traceTimeline}>
      {traces.map((trace) => (
        <details
          key={trace.id}
          className={styles.traceItem}
          open={streaming || trace.status === "running"}
        >
          <summary className={styles.traceSummary}>
            <span className={styles.traceIcon}>{traceIcon(trace)}</span>
            <span className={styles.traceTitle}>{traceTitle(trace)}</span>
            <span className={traceStatusClass(trace.status)}>
              {traceStatusLabel(trace.status)}
            </span>
          </summary>
          <div className={styles.traceBody}>
            {trace.content ? (
              <p className={styles.traceText}>{trace.content}</p>
            ) : null}
            {trace.input ? (
              <TracePreview label="输入" value={trace.input} />
            ) : null}
            {trace.output ? (
              <TracePreview label="输出" value={trace.output} />
            ) : null}
            {trace.error ? (
              <TracePreview label="错误" value={trace.error} danger />
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function TracePreview({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  const displayValue = formatTracePreviewValue(value);

  return (
    <div className={styles.tracePreview}>
      <span className={danger ? styles.tracePreviewDanger : undefined}>
        {label}
      </span>
      <div
        className={`${styles.tracePreviewValue} ${
          danger ? styles.tracePreviewDangerValue : ""
        }`}
      >
        {displayValue}
      </div>
    </div>
  );
}

function formatTracePreviewValue(value: string): string {
  return normalizeTracePreviewText(extractReadableTraceText(value) ?? value);
}

function extractReadableTraceText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const parsed = parseTraceJson(value);

    if (parsed !== undefined) {
      return extractReadableTraceText(parsed);
    }

    return extractReadableTextFromSerializedJson(value) ?? value;
  }

  if (Array.isArray(value)) {
    if (isLangChainIdArray(value)) {
      return undefined;
    }

    const parts = value
      .map((item) => extractReadableTraceText(item))
      .filter((item): item is string => Boolean(item));

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.description === "string") {
      return record.description;
    }

    for (const key of [
      "content",
      "text",
      "summary",
      "result",
      "output",
      "message",
      "kwargs",
      "lc_kwargs",
      "data",
      "messages",
    ]) {
      const readable = extractReadableTraceText(record[key]);

      if (readable) {
        return readable;
      }
    }
  }

  return undefined;
}

function parseTraceJson(value: string): unknown | undefined {
  const trimmed = value.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function extractReadableTextFromSerializedJson(
  value: string,
): string | undefined {
  for (const key of ["description", "text", "content", "summary", "result"]) {
    const text = extractJsonStringField(value, key);

    if (text) {
      return text;
    }
  }

  return undefined;
}

function extractJsonStringField(value: string, key: string): string | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(
    value,
  );

  if (!match?.[1]) {
    return undefined;
  }

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function normalizeTracePreviewText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLangChainIdArray(value: unknown[]): boolean {
  return (
    value.every((item) => typeof item === "string") &&
    value.some((item) => item.includes("langchain"))
  );
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url));
  return parseJsonResponse<T>(response);
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(response);
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(response);
}

async function apiDelete(url: string): Promise<void> {
  const response = await fetch(apiUrl(url), {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }

  return payload as T;
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function readSse(
  response: Response,
  options: {
    onEvent: (event: string, data: Record<string, unknown>) => void;
  },
) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("当前浏览器不支持流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);

      if (parsed) {
        options.onEvent(parsed.event, parsed.data);
      }
    }
  }
}

function parseSseFrame(frame: string) {
  const event = frame
    .split("\n")
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length);
  const dataLine = frame
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);

  if (!event || !dataLine) {
    return null;
  }

  return {
    event,
    data: JSON.parse(dataLine) as Record<string, unknown>,
  };
}

function isTraceStreamEvent(event: string): boolean {
  return (
    event === "reasoning.delta" ||
    event === "reasoning.done" ||
    event === "tool.started" ||
    event === "tool.done" ||
    event === "skill.started" ||
    event === "skill.done"
  );
}

function mergeMessageTrace(
  message: ChatMessage,
  trace: AgentTraceEntry,
): ChatMessage {
  const traces = traceTimeline(message.metadataJson);
  const nextTraces = traces.some((item) => item.id === trace.id)
    ? traces.map((item) => (item.id === trace.id ? { ...item, ...trace } : item))
    : [...traces, trace];

  return {
    ...message,
    metadataJson: {
      ...(message.metadataJson ?? {}),
      traces: nextTraces,
    },
  };
}

function mergeSavedAssistantMessage(
  current: ChatMessage,
  saved: ChatMessage,
): ChatMessage {
  const currentTraces = traceTimeline(current.metadataJson);
  const savedTraces = traceTimeline(saved.metadataJson);

  if (currentTraces.length === 0 && savedTraces.length === 0) {
    return saved;
  }

  return {
    ...saved,
    metadataJson: {
      ...(current.metadataJson ?? {}),
      ...(saved.metadataJson ?? {}),
      traces: mergeTraceLists(currentTraces, savedTraces),
    },
  };
}

function mergeTraceLists(
  currentTraces: AgentTraceEntry[],
  savedTraces: AgentTraceEntry[],
): AgentTraceEntry[] {
  if (currentTraces.length === 0) {
    return savedTraces;
  }

  if (savedTraces.length === 0) {
    return currentTraces;
  }

  const traceById = new Map(
    currentTraces.map((trace) => [trace.id, trace] as const),
  );

  for (const trace of savedTraces) {
    traceById.set(trace.id, trace);
  }

  return Array.from(traceById.values());
}

function traceTimeline(
  metadataJson: AgentMessageMetadata | null | undefined,
): AgentTraceEntry[] {
  if (!metadataJson?.traces || !Array.isArray(metadataJson.traces)) {
    return [];
  }

  return metadataJson.traces.filter(isAgentTraceEntry);
}

function isAgentTraceEntry(trace: unknown): trace is AgentTraceEntry {
  if (!trace || typeof trace !== "object") {
    return false;
  }

  const candidate = trace as AgentTraceEntry;

  return (
    typeof candidate.id === "string" &&
    (candidate.kind === "reasoning" ||
      candidate.kind === "tool" ||
      candidate.kind === "skill") &&
    (candidate.status === "running" ||
      candidate.status === "success" ||
      candidate.status === "error")
  );
}

function traceIcon(trace: AgentTraceEntry) {
  if (trace.status === "running") {
    return <LoadingOutlined spin />;
  }

  if (trace.kind === "reasoning") {
    return <BulbOutlined />;
  }

  if (trace.kind === "skill") {
    return <BranchesOutlined />;
  }

  return <ToolOutlined />;
}

function traceTitle(trace: AgentTraceEntry): string {
  if (trace.kind === "reasoning") {
    return trace.status === "running" ? "正在思考" : "思考";
  }

  if (trace.kind === "skill") {
    return trace.name ? `Skill 调用 · ${trace.name}` : "Skill 调用";
  }

  return trace.name ? `工具调用 · ${trace.name}` : "工具调用";
}

function traceStatusLabel(status: AgentTraceStatus): string {
  if (status === "running") {
    return "进行中";
  }

  if (status === "error") {
    return "失败";
  }

  return "完成";
}

function traceStatusClass(status: AgentTraceStatus): string {
  if (status === "running") {
    return styles.traceStatusRunning;
  }

  if (status === "error") {
    return styles.traceStatusError;
  }

  return styles.traceStatusSuccess;
}

function groupConversation(updatedAt: string): string {
  const now = new Date();
  const updated = new Date(updatedAt);

  if (updated.toDateString() === now.toDateString()) {
    return "今天";
  }

  return "更早";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败";
}

function isRuntimeMapped(
  provider: ProviderOption | undefined,
  model: ModelOption | undefined,
): boolean {
  const providerNpm = model?.providerNpm ?? provider?.providerNpm;

  return (
    provider?.id === "openai" ||
    provider?.id === "openrouter" ||
    provider?.id === "anthropic" ||
    provider?.id === "google" ||
    providerNpm === "@ai-sdk/openai" ||
    providerNpm === "@ai-sdk/openai-compatible" ||
    providerNpm === "@openrouter/ai-sdk-provider" ||
    providerNpm === "@ai-sdk/anthropic" ||
    providerNpm === "@ai-sdk/google"
  );
}
