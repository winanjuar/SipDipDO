CREATE TYPE "public"."capital_type" AS ENUM('Modal Tetap', 'Modal Bergerak', 'Modal Operasional');--> statement-breakpoint
CREATE TYPE "public"."ledger_actor" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."mfa_action_type" AS ENUM('konfirmasi', 'input_langsung', 'kompensasi');--> statement-breakpoint
CREATE TYPE "public"."mom_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('menunggu_konfirmasi', 'terkonfirmasi', 'ditolak', 'kedaluwarsa');--> statement-breakpoint
CREATE TYPE "public"."owner_lifecycle" AS ENUM('diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar');--> statement-breakpoint
CREATE TYPE "public"."price_kind" AS ENUM('beli', 'jual');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('calon_owner', 'owner', 'coo');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" uuid,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buy_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"capital_type" "capital_type" NOT NULL,
	"quantity" integer NOT NULL,
	"locked_price" numeric(18, 2) NOT NULL,
	"locked_price_ref" uuid NOT NULL,
	"referral_owner_id" uuid,
	"status" "order_status" DEFAULT 'menunggu_konfirmasi' NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capital_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capital_type" "capital_type" NOT NULL,
	"initial_requirement" numeric(18, 2) NOT NULL,
	"final_requirement" numeric(18, 2) NOT NULL,
	"fulfillment" numeric(18, 2) DEFAULT '0' NOT NULL,
	"utilization" numeric(18, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_date" date NOT NULL,
	"redeemed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"points" integer NOT NULL,
	"period_id" uuid,
	"mom_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"cut_off_date" date,
	"is_finalized" boolean DEFAULT false NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coo_tenures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"mom_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"ledger_tx_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"capital_type" "capital_type" NOT NULL,
	"quantity" integer NOT NULL,
	"shares" integer NOT NULL,
	"ceil" integer NOT NULL,
	"final_price" numeric(18, 2) NOT NULL,
	"final_price_ref" uuid NOT NULL,
	"actual_amount" numeric(18, 2) NOT NULL,
	"buy_order_id" uuid,
	"capital_item_id" uuid,
	"payment_date" date NOT NULL,
	"payment_method" text NOT NULL,
	"compensation_of_id" uuid,
	"actor" "ledger_actor" DEFAULT 'user' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"mom_date" date NOT NULL,
	"status" "mom_status" DEFAULT 'draft' NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coo_id" uuid NOT NULL,
	"action_type" "mfa_action_type" NOT NULL,
	"target_ref" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" "owner_lifecycle" DEFAULT 'diajukan' NOT NULL,
	"first_effective_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"capital_type" "capital_type" NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"ceil" integer DEFAULT 0 NOT NULL,
	"actual_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_owner_capital_type_unique" UNIQUE("owner_id","capital_type")
);
--> statement-breakpoint
CREATE TABLE "price_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "price_kind" NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"mom_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_periods_kind_effective_date_unique" UNIQUE("kind","effective_date")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"wa_contact" text,
	"email_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "profit_distribution_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"distribution_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"portion" numeric(9, 6) NOT NULL,
	"contribution_points" integer DEFAULT 0 NOT NULL,
	"dividend_amount" numeric(18, 2) NOT NULL,
	"incentive_amount" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profit_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audited_profit" numeric(18, 2) NOT NULL,
	"retained_profit" numeric(18, 2) NOT NULL,
	"distributable_profit" numeric(18, 2) NOT NULL,
	"charity_ratio" numeric(9, 6) NOT NULL,
	"dividend_ratio" numeric(9, 6) NOT NULL,
	"incentive_ratio" numeric(9, 6) NOT NULL,
	"charity_pool" numeric(18, 2) NOT NULL,
	"dividend_pool" numeric(18, 2) NOT NULL,
	"incentive_pool" numeric(18, 2) NOT NULL,
	"mom_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rkap_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"instant_adjustment_budget" numeric(18, 2) DEFAULT '0' NOT NULL,
	"instant_adjustment_used" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"mom_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"role" "role_name" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_owner_role_unique" UNIQUE("owner_id","role")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_owners_id_fk" FOREIGN KEY ("actor") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_orders" ADD CONSTRAINT "buy_orders_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_orders" ADD CONSTRAINT "buy_orders_locked_price_ref_price_periods_id_fk" FOREIGN KEY ("locked_price_ref") REFERENCES "public"."price_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_orders" ADD CONSTRAINT "buy_orders_referral_owner_id_owners_id_fk" FOREIGN KEY ("referral_owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_items" ADD CONSTRAINT "capital_items_phase_id_rkap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."rkap_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_entries" ADD CONSTRAINT "contribution_entries_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_entries" ADD CONSTRAINT "contribution_entries_item_id_contribution_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."contribution_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_entries" ADD CONSTRAINT "contribution_entries_period_id_contribution_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."contribution_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_entries" ADD CONSTRAINT "contribution_entries_recorded_by_owners_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_items" ADD CONSTRAINT "contribution_items_period_id_contribution_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."contribution_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_items" ADD CONSTRAINT "contribution_items_mom_ref_moms_id_fk" FOREIGN KEY ("mom_ref") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coo_tenures" ADD CONSTRAINT "coo_tenures_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_ledger_tx_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_tx_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_final_price_ref_price_periods_id_fk" FOREIGN KEY ("final_price_ref") REFERENCES "public"."price_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_buy_order_id_buy_orders_id_fk" FOREIGN KEY ("buy_order_id") REFERENCES "public"."buy_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_capital_item_id_capital_items_id_fk" FOREIGN KEY ("capital_item_id") REFERENCES "public"."capital_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_coo_id_owners_id_fk" FOREIGN KEY ("coo_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_periods" ADD CONSTRAINT "price_periods_mom_ref_moms_id_fk" FOREIGN KEY ("mom_ref") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_distribution_lines" ADD CONSTRAINT "profit_distribution_lines_distribution_id_profit_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."profit_distributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_distribution_lines" ADD CONSTRAINT "profit_distribution_lines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_distributions" ADD CONSTRAINT "profit_distributions_mom_ref_moms_id_fk" FOREIGN KEY ("mom_ref") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rkap_phases" ADD CONSTRAINT "rkap_phases_mom_ref_moms_id_fk" FOREIGN KEY ("mom_ref") REFERENCES "public"."moms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;