import { AgentRunnerService } from "./modules/agent/agent-runner.service";
import { ConversationService } from "./modules/conversation/conversation.service";
import {
  PrismaConversationRepository,
  PrismaMessageRepository,
} from "./modules/conversation/prisma-conversation.repository";
import { PrismaModelCatalogRepository } from "./modules/model-catalog/model-catalog.repository";
import { ModelCatalogService } from "./modules/model-catalog/model-catalog.service";

const conversationRepository = new PrismaConversationRepository();
const messageRepository = new PrismaMessageRepository();
const modelCatalogRepository = new PrismaModelCatalogRepository();

export const conversationService = new ConversationService(
  conversationRepository,
  messageRepository,
);

export const modelCatalogService = new ModelCatalogService(
  modelCatalogRepository,
);

export const agentRunnerService = new AgentRunnerService();
