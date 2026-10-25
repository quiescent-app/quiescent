CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"content" text,
	"reading_progress" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "articles_reading_progress_check" CHECK ("articles"."reading_progress" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_user_url_unique" ON "articles" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "articles_user_id_idx" ON "articles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "articles_domain_idx" ON "articles" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "articles_last_accessed_idx" ON "articles" USING btree ("last_accessed_at");