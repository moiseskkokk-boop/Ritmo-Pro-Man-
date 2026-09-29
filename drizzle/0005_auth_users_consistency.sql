ALTER TABLE `users`
	ADD `passwordHash` varchar(255),
	ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);
