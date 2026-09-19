CREATE TYPE "public"."owner_status" AS ENUM('diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_owner_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coo_tenures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "outbox_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to_address" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "owner_bank_accounts" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"bank_name" text,
	"account_holder_name" text,
	"account_number" text
);
--> statement-breakpoint
CREATE TABLE "owner_emergency_contacts" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"phone_number" text,
	"relationship" text
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text,
	"alias" text,
	"email" text NOT NULL,
	"phone_number" text,
	"status" "owner_status" DEFAULT 'diajukan' NOT NULL,
	"rejection_reason" text,
	"first_effective_at" timestamp with time zone,
	"referral_code" text NOT NULL,
	"used_referral_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_unique" UNIQUE("email"),
	CONSTRAINT "owners_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_owner_id_owners_id_fk" FOREIGN KEY ("actor_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coo_tenures" ADD CONSTRAINT "coo_tenures_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_bank_accounts" ADD CONSTRAINT "owner_bank_accounts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_emergency_contacts" ADD CONSTRAINT "owner_emergency_contacts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "coo_tenures_owner_started_idx" ON "coo_tenures" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "outbox_emails_status_send_after_idx" ON "outbox_emails" USING btree ("status","send_after");