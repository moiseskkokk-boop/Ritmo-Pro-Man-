CREATE TABLE `mercadopago_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(191) NOT NULL,
	`topic` varchar(64) NOT NULL,
	`resourceId` varchar(100) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'processing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `mercadopago_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `mercadopago_webhook_events_eventKey_unique` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `subscription_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`userId` int NOT NULL,
	`providerPaymentId` varchar(100) NOT NULL,
	`status` varchar(32) NOT NULL,
	`amount` varchar(16),
	`currency` varchar(3),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_payments_providerPaymentId_unique` UNIQUE(`providerPaymentId`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`code` varchar(40) NOT NULL,
	`name` varchar(100) NOT NULL,
	`interval` varchar(20) NOT NULL,
	`amount` varchar(16) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planCode` varchar(40) NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'mercadopago',
	`status` enum('pending','active','payment_pending','cancelled','expired','error') NOT NULL DEFAULT 'pending',
	`externalReference` varchar(191) NOT NULL,
	`providerSubscriptionId` varchar(100),
	`checkoutUrl` varchar(1000),
	`amount` varchar(16) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelledAt` timestamp,
	`expiredAt` timestamp,
	`lastPaymentId` varchar(100),
	`lastPaymentStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_subscriptions_externalReference_unique` UNIQUE(`externalReference`),
	CONSTRAINT `user_subscriptions_providerSubscriptionId_unique` UNIQUE(`providerSubscriptionId`)
);
