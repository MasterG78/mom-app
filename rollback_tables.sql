-- SQL Rollback Plan
-- Revert column renames in species_groups
ALTER TABLE "species_groups" RENAME COLUMN "group_name" TO "SpeciesGroup";
ALTER TABLE "species_groups" RENAME COLUMN "species_id" TO "Species_id";

-- Revert table renames
ALTER TABLE "inventory" RENAME TO "Inventory";
ALTER TABLE "products" RENAME TO "Products";
ALTER TABLE "species" RENAME TO "Species";
ALTER TABLE "species_groups" RENAME TO "SpeciesGroups";
ALTER TABLE "status_changes" RENAME TO "StatusChanges";
ALTER TABLE "statuses" RENAME TO "StatusList";
