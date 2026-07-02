CREATE TABLE `collection_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collection_id` int NOT NULL,
	`resource_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`section` varchar(255),
	`required` boolean NOT NULL DEFAULT true,
	`notes` text,
	`added_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_collection_item` UNIQUE(`collection_id`,`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_id` varchar(24) NOT NULL,
	`organization_id` int NOT NULL,
	`owner_user_id` int,
	`kind` enum('playlist','path') NOT NULL DEFAULT 'playlist',
	`title` varchar(255) NOT NULL,
	`description` text,
	`goal` varchar(255),
	`cover_url` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_public_id_unique` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `learning_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_id` varchar(24) NOT NULL,
	`source_type` enum('external','native') NOT NULL DEFAULT 'external',
	`owner_organization_id` int,
	`platform` enum('youtube','coursera','udemy','edx','linkedin','other'),
	`external_id` varchar(255),
	`url` varchar(2048),
	`title` varchar(512) NOT NULL,
	`description` text,
	`thumbnail_url` text,
	`provider` varchar(255),
	`duration_seconds` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learning_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `learning_resources_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `uq_resource_platform_external` UNIQUE(`platform`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`role` enum('owner','admin','manager','mentor','member') NOT NULL DEFAULT 'member',
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_membership_user_org` UNIQUE(`user_id`,`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_id` varchar(24) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('personal','team') NOT NULL DEFAULT 'team',
	`logo_url` text,
	`favicon_url` text,
	`primary_color` varchar(9),
	`accent_color` varchar(9),
	`theme_config` text,
	`custom_domain` varchar(255),
	`custom_domain_verified` boolean NOT NULL DEFAULT false,
	`branding_enabled` boolean NOT NULL DEFAULT false,
	`stripe_customer_id` varchar(255),
	`plan` varchar(50) NOT NULL DEFAULT 'free',
	`subscription_status` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `organizations_custom_domain_unique` UNIQUE(`custom_domain`),
	CONSTRAINT `uq_org_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`resource_id` int NOT NULL,
	`status` enum('not_started','in_progress','completed','paused') NOT NULL DEFAULT 'not_started',
	`progress` int NOT NULL DEFAULT 0,
	`watch_seconds` int NOT NULL DEFAULT 0,
	`started_at` timestamp,
	`completed_at` timestamp,
	`last_activity_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_activities_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_activity_user_resource` UNIQUE(`user_id`,`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_id` varchar(24) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`password_hash` varchar(255),
	`email_verified_at` timestamp,
	`avatar_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_signed_in_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_items` ADD CONSTRAINT `collection_items_resource_id_learning_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `learning_resources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_resources` ADD CONSTRAINT `learning_resources_owner_organization_id_organizations_id_fk` FOREIGN KEY (`owner_organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_activities` ADD CONSTRAINT `user_activities_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_activities` ADD CONSTRAINT `user_activities_resource_id_learning_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `learning_resources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_collection_item_collection` ON `collection_items` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_org` ON `collections` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_resource_owner` ON `learning_resources` (`owner_organization_id`);--> statement-breakpoint
CREATE INDEX `idx_membership_org` ON `memberships` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_user` ON `user_activities` (`user_id`);