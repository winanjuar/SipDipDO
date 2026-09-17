CREATE TYPE "public"."owner_status" AS ENUM('diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar');--> statement-breakpoint
CREATE TABLE "coo_tenures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" "owner_status" DEFAULT 'diajukan' NOT NULL,
	"rejection_reason" text,
	"first_effective_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "coo_tenures" ADD CONSTRAINT "coo_tenures_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coo_tenures_owner_started_idx" ON "coo_tenures" USING btree ("owner_id","started_at");