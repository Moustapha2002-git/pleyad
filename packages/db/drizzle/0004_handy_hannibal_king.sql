CREATE TABLE `path_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organization_id` int NOT NULL,
	`collection_id` int NOT NULL,
	`learner_user_id` int NOT NULL,
	`assigned_by_user_id` int NOT NULL,
	`due_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `path_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_path_assignment` UNIQUE(`collection_id`,`learner_user_id`)
);
--> statement-breakpoint
ALTER TABLE `path_assignments` ADD CONSTRAINT `path_assignments_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `path_assignments` ADD CONSTRAINT `path_assignments_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `path_assignments` ADD CONSTRAINT `path_assignments_learner_user_id_users_id_fk` FOREIGN KEY (`learner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `path_assignments` ADD CONSTRAINT `path_assignments_assigned_by_user_id_users_id_fk` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_path_assignments_org` ON `path_assignments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_path_assignments_learner` ON `path_assignments` (`learner_user_id`);