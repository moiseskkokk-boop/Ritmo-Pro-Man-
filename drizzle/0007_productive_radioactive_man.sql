CREATE TABLE `body_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`analysisMonth` varchar(7) NOT NULL,
	`objective` varchar(80),
	`photoKeys` text NOT NULL,
	`bodyFatEstimatePercent` int,
	`confidencePercent` int NOT NULL,
	`analysisJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `body_analyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `body_analyses_user_month` UNIQUE(`userId`,`analysisMonth`)
);
