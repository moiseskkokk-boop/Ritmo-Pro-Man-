CREATE TABLE `daily_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`activityDate` varchar(10) NOT NULL,
	`workoutId` varchar(2),
	`completedCount` int NOT NULL DEFAULT 0,
	`cardioMinutes` int,
	`mealsNote` text,
	`waterLiters` varchar(10),
	`recovery` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_logs_user_date` UNIQUE(`userId`,`activityDate`)
);
--> statement-breakpoint
CREATE TABLE `weekly_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`objective` varchar(80) NOT NULL,
	`heightCm` int NOT NULL,
	`benchPressLevel` varchar(80) NOT NULL,
	`squatLevel` varchar(80) NOT NULL,
	`cardio` varchar(40) NOT NULL,
	`sleep` varchar(40) NOT NULL,
	`recovery` varchar(40) NOT NULL,
	`fatigue` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_assessments_user_week` UNIQUE(`userId`,`weekStart`)
);
