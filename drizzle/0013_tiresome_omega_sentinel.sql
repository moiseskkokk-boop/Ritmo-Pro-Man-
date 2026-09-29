CREATE TABLE `workout_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`source` enum('manual','ai','customized','day5') NOT NULL DEFAULT 'manual',
	`baseWorkoutId` varchar(8),
	`name` varchar(120) NOT NULL,
	`objective` varchar(80) NOT NULL,
	`focusGroup` varchar(80) NOT NULL,
	`durationMinutes` int NOT NULL,
	`notes` text,
	`exercisesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workout_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `workout_plans_user_created` ON `workout_plans` (`userId`,`createdAt`);