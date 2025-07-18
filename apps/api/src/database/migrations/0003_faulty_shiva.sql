CREATE INDEX "hospitals_active_state_idx" ON "hospitals" USING btree ("is_active","state");--> statement-breakpoint
CREATE INDEX "hospitals_active_state_city_idx" ON "hospitals" USING btree ("is_active","state","city");--> statement-breakpoint
CREATE INDEX "hospitals_active_last_updated_idx" ON "hospitals" USING btree ("is_active","last_updated");--> statement-breakpoint
CREATE INDEX "hospitals_ccn_idx" ON "hospitals" USING btree ("ccn");--> statement-breakpoint
CREATE INDEX "prices_hospital_active_idx" ON "prices" USING btree ("hospital_id","is_active");--> statement-breakpoint
CREATE INDEX "prices_active_updated_idx" ON "prices" USING btree ("is_active","last_updated");--> statement-breakpoint
CREATE INDEX "prices_hospital_active_updated_idx" ON "prices" USING btree ("hospital_id","is_active","last_updated");--> statement-breakpoint
CREATE INDEX "prices_active_service_idx" ON "prices" USING btree ("is_active","service_name");--> statement-breakpoint
CREATE INDEX "prices_active_category_idx" ON "prices" USING btree ("is_active","category");--> statement-breakpoint
CREATE INDEX "prices_active_gross_charge_idx" ON "prices" USING btree ("is_active","gross_charge");--> statement-breakpoint
CREATE INDEX "prices_active_hospital_service_idx" ON "prices" USING btree ("is_active","hospital_id","service_name");--> statement-breakpoint
CREATE INDEX "prices_hospital_reporting_period_idx" ON "prices" USING btree ("hospital_id","reporting_period");