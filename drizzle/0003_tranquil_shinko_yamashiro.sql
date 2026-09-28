CREATE TABLE `wearable_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`externalId` varchar(160) NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`activityStartedAt` timestamp,
	`activityType` varchar(80),
	`durationMinutes` int,
	`caloriesKcal` int,
	`averageHeartRate` int,
	`maxHeartRate` int,
	`steps` int,
	`distanceKm` varchar(16),
	`cardioMinutes` int,
	`sleepMinutes` int,
	`recoveryNote` varchar(120),
	`rawMetrics` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wearable_activities_id` PRIMARY KEY(`id`),
	CONSTRAINT `wearable_activities_user_provider_external` UNIQUE(`userId`,`provider`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `wearable_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(40) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'authorization_required',
	`connectedAt` timestamp,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wearable_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `wearable_connections_user_provider` UNIQUE(`userId`,`provider`)
);
