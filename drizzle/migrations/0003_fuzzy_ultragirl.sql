CREATE TYPE "public"."price_type" AS ENUM('beli', 'jual');--> statement-breakpoint
CREATE TABLE "price_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "price_type" NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"mom_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_periods" ADD CONSTRAINT "price_periods_mom_id_moms_id_fk" FOREIGN KEY ("mom_id") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_periods_type_effective_date_idx" ON "price_periods" USING btree ("type","effective_date");--> statement-breakpoint
CREATE INDEX "price_periods_effective_date_idx" ON "price_periods" USING btree ("effective_date");