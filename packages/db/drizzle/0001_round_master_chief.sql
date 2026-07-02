CREATE TABLE `collection_dimensions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collection_id` int NOT NULL,
	`dimension` enum('knowledge','skills','human_development') NOT NULL,
	CONSTRAINT `collection_dimensions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_collection_dimension` UNIQUE(`collection_id`,`dimension`)
);
--> statement-breakpoint
ALTER TABLE `collection_dimensions` ADD CONSTRAINT `collection_dimensions_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_collection_dimensions_collection` ON `collection_dimensions` (`collection_id`);