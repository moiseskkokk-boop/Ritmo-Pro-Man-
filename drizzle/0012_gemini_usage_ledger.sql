CREATE TABLE IF NOT EXISTS `gemini_usage_daily` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`usageDate` varchar(10) NOT NULL,
	`userId` int NOT NULL DEFAULT 0,
	`feature` varchar(64) NOT NULL DEFAULT 'general',
	`calls` int NOT NULL DEFAULT 0,
	`inputTokens` bigint NOT NULL DEFAULT 0,
	`outputTokens` bigint NOT NULL DEFAULT 0,
	`totalTokens` bigint NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gemini_usage_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `gemini_usage_scope` UNIQUE(`usageDate`,`userId`,`feature`),
	KEY `gemini_usage_date` (`usageDate`)
);
