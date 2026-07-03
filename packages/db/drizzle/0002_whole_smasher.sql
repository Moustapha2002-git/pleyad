CREATE TABLE `mentor_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`mentor_user_id` int NOT NULL,
	`learner_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mentor_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_mentor_assignment` UNIQUE(`organization_id`,`mentor_user_id`,`learner_user_id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`sender_user_id` int NOT NULL,
	`recipient_user_id` int NOT NULL,
	`body` text NOT NULL,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mentor_assignments` ADD CONSTRAINT `mentor_assignments_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentor_assignments` ADD CONSTRAINT `mentor_assignments_mentor_user_id_users_id_fk` FOREIGN KEY (`mentor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentor_assignments` ADD CONSTRAINT `mentor_assignments_learner_user_id_users_id_fk` FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_sender_user_id_users_id_fk` FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_recipient_user_id_users_id_fk` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mentor_assignments_org` ON `mentor_assignments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_org` ON `messages` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_pair` ON `messages` (`sender_user_id`,`recipient_user_id`);