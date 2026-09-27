CREATE TYPE "public"."capital_type" AS ENUM('tetap', 'bergerak');--> statement-breakpoint
CREATE TYPE "public"."rkap_phase_status" AS ENUM('berjalan', 'arsip');--> statement-breakpoint
CREATE TABLE "capital_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capital_type" "capital_type" NOT NULL,
	"initial_requirement" numeric(18, 2) NOT NULL,
	"final_requirement" numeric(18, 2) NOT NULL,
	"utilization" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rkap_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"item_id" uuid,
	"adjustment_type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"mom_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rkap_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "rkap_phase_status" DEFAULT 'berjalan' NOT NULL,
	"mom_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capital_items" ADD CONSTRAINT "capital_items_phase_id_rkap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."rkap_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rkap_adjustments" ADD CONSTRAINT "rkap_adjustments_phase_id_rkap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."rkap_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rkap_adjustments" ADD CONSTRAINT "rkap_adjustments_item_id_capital_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."capital_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rkap_adjustments" ADD CONSTRAINT "rkap_adjustments_mom_id_moms_id_fk" FOREIGN KEY ("mom_id") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rkap_phases" ADD CONSTRAINT "rkap_phases_mom_id_moms_id_fk" FOREIGN KEY ("mom_id") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capital_items_phase_idx" ON "capital_items" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "capital_items_capital_type_idx" ON "capital_items" USING btree ("capital_type");--> statement-breakpoint
CREATE INDEX "rkap_adjustments_phase_idx" ON "rkap_adjustments" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "rkap_phases_status_idx" ON "rkap_phases" USING btree ("status");