CREATE TABLE `body_measurements` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`dataJson` text NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`photoKey` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `body_measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coach_turns` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`contextAuthorized` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coach_turns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fitness_preferences` (
	`userId` int NOT NULL,
	`dataJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fitness_preferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `fitness_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entityId` varchar(80) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`previousJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fitness_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`status` enum('in_progress','completed') NOT NULL DEFAULT 'in_progress',
	`snapshotJson` text NOT NULL,
	`note` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `training_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_sessions_user_date` UNIQUE(`userId`,`activityDate`)
);
--> statement-breakpoint
CREATE TABLE `training_sets` (
	`id` varchar(80) NOT NULL,
	`sessionId` varchar(36) NOT NULL,
	`exerciseIndex` int NOT NULL,
	`setIndex` int NOT NULL,
	`exerciseId` varchar(8) NOT NULL,
	`reps` int,
	`seconds` int,
	`loadKg` varchar(12),
	`note` varchar(500),
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `training_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wellness_entries` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`kind` enum('meal','water','cardio') NOT NULL,
	`dataJson` text NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wellness_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `body_measurements_user_date` ON `body_measurements` (`userId`,`activityDate`);--> statement-breakpoint
CREATE INDEX `coach_turns_user_created` ON `coach_turns` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `fitness_revisions_user_entity` ON `fitness_revisions` (`userId`,`entityId`);--> statement-breakpoint
CREATE INDEX `training_sets_session` ON `training_sets` (`sessionId`);--> statement-breakpoint
CREATE INDEX `wellness_entries_user_date` ON `wellness_entries` (`userId`,`activityDate`);