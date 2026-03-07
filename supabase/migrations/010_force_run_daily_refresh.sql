-- Manual trigger after bulk listing load:
-- Executes the same routine as the scheduled cron job.
select public.run_daily_analytics_refresh();
