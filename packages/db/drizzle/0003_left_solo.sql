CREATE TABLE `mentoring_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`mentor_user_id` int NOT NULL,
	`learner_user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`scheduled_at` timestamp NOT NULL,
	`duration_minutes` int NOT NULL DEFAULT 30,
	`status` enum('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mentoring_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mentoring_sessions` ADD CONSTRAINT `mentoring_sessions_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentoring_sessions` ADD CONSTRAINT `mentoring_sessions_mentor_user_id_users_id_fk` FOREIGN KEY (`mentor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentoring_sessions` ADD CONSTRAINT `mentoring_sessions_learner_user_id_users_id_fk` FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentoring_sessions` ADD CONSTRAINT `mentoring_sessions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_sessions_org` ON `mentoring_sessions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_mentor` ON `mentoring_sessions` (`mentor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_learner` ON `mentoring_sessions` (`learner_user_id`);