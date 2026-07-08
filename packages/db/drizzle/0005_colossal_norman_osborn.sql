CREATE TABLE `learner_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`mentor_user_id` int NOT NULL,
	`learner_user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`instructions` text,
	`due_at` timestamp,
	`status` enum('open','done') NOT NULL DEFAULT 'open',
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learner_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mentor_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`mentor_user_id` int NOT NULL,
	`learner_user_id` int NOT NULL,
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mentor_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `learner_tasks` ADD CONSTRAINT `learner_tasks_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_tasks` ADD CONSTRAINT `learner_tasks_mentor_user_id_users_id_fk` FOREIGN KEY (`mentor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_tasks` ADD CONSTRAINT `learner_tasks_learner_user_id_users_id_fk` FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentor_feedback` ADD CONSTRAINT `mentor_feedback_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentor_feedback` ADD CONSTRAINT `mentor_feedback_mentor_user_id_users_id_fk` FOREIGN KEY (`mentor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mentor_feedback` ADD CONSTRAINT `mentor_feedback_learner_user_id_users_id_fk` FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_learner_tasks_org` ON `learner_tasks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_learner_tasks_learner` ON `learner_tasks` (`learner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_mentor_feedback_org` ON `mentor_feedback` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_mentor_feedback_learner` ON `mentor_feedback` (`learner_user_id`);