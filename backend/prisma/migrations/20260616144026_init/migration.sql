-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `providerId` VARCHAR(80) NOT NULL,
    `modelId` VARCHAR(200) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` ENUM('user', 'assistant', 'system') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` ENUM('local', 'loading', 'updating', 'success', 'error', 'abort') NOT NULL DEFAULT 'success',
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelProviderCache` (
    `providerId` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `apiBaseUrl` VARCHAR(500) NULL,
    `envNames` JSON NOT NULL,
    `rawJson` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`providerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelCache` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(80) NOT NULL,
    `modelId` VARCHAR(200) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `family` VARCHAR(80) NULL,
    `toolCall` BOOLEAN NOT NULL DEFAULT false,
    `contextLimit` INTEGER NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'active',
    `rawJson` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModelCache_providerId_idx`(`providerId`),
    UNIQUE INDEX `ModelCache_providerId_modelId_key`(`providerId`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
