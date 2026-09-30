CREATE TABLE `auth_email_tokens` (
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`purpose` enum('verify_email','password_reset','email_change') NOT NULL,
	`targetEmail` varchar(320),
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_email_tokens_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`rateKey` varchar(64) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	CONSTRAINT `auth_rate_limits_rateKey` PRIMARY KEY(`rateKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `termsAcceptedVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `privacyAcceptedVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
UPDATE `users` SET `emailVerifiedAt` = `createdAt` WHERE `email` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `pendingEmail` varchar(320);--> statement-breakpoint
CREATE INDEX `auth_email_tokens_user_purpose` ON `auth_email_tokens` (`userId`,`purpose`);
