ALTER TABLE "public"."Inventory"
ADD CONSTRAINT "Inventory_tagger_fkey"
FOREIGN KEY (tagger)
REFERENCES "public"."profiles" (id);
