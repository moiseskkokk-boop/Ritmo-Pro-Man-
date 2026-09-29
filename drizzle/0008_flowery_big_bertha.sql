CREATE TABLE `wearable_daily_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`timeZone` varchar(64),
	`workoutCaloriesKcal` int,
	`activityCaloriesKcal` int,
	`totalCaloriesKcal` int,
	`durationMinutes` int,
	`cardioMinutes` int,
	`distanceKm` varchar(16),
	`steps` int,
	`averageHeartRate` int,
	`minHeartRate` int,
	`maxHeartRate` int,
	`sleepMinutes` int,
	`recoveryScore` int,
	`recoveryNote` varchar(120),
	`activityCount` int,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wearable_daily_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `wearable_daily_summaries_user_provider_date` UNIQUE(`userId`,`provider`,`activityDate`)
);
--> statement-breakpoint
CREATE TABLE `wearable_oauth_states` (
	`stateHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`verifierEncrypted` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wearable_oauth_states_stateHash` PRIMARY KEY(`stateHash`)
);
--> statement-breakpoint
ALTER TABLE `wearable_activities` ADD `activityCaloriesKcal` int;--> statement-breakpoint
ALTER TABLE `wearable_activities` ADD `totalCaloriesKcal` int;--> statement-breakpoint
ALTER TABLE `wearable_activities` ADD `sourceType` varchar(24) DEFAULT 'provider_api' NOT NULL;--> statement-breakpoint
ALTER TABLE `wearable_activities` ADD `sourceTimeZone` varchar(64);--> statement-breakpoint
ALTER TABLE `wearable_activities` ADD `utcOffsetMinutes` int;--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `tokenPayloadEncrypted` text;--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `tokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `grantedScopes` text;--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `timeZone` varchar(64);--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `lastSyncStatus` varchar(32) DEFAULT 'never_synced' NOT NULL;--> statement-breakpoint
ALTER TABLE `wearable_connections` ADD `lastSyncError` varchar(255);
--> statement-breakpoint
UPDATE `wearable_activities` SET `sourceType` = 'manual_import' WHERE `sourceType` = 'provider_api';
