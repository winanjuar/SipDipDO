CREATE TYPE "public"."mom_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TABLE "moms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"held_at" timestamp with time zone NOT NULL,
	"status" "mom_status" DEFAULT 'draft' NOT NULL,
	"content_text" text,
	"pdf_path" text,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "moms_held_at_idx" ON "moms" USING btree ("held_at");--> statement-breakpoint
CREATE INDEX "moms_status_idx" ON "moms" USING btree ("status");