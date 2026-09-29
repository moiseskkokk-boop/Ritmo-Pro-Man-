CREATE INDEX `subscription_payments_subscription` ON `subscription_payments` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `subscription_payments_user` ON `subscription_payments` (`userId`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_user_history` ON `user_subscriptions` (`userId`,`createdAt`);