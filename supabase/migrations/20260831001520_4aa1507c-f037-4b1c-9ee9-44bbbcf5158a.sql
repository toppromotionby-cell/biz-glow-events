-- lovable-cron-fallback-reviewed: 144 runs/day; напоминания «за 15 минут», утренний/вечерний дайджест и импорт правок из Google требуют регулярной проверки времени — событийных триггеров для наступления момента времени нет
SELECT cron.schedule(
  'planner-tick',
  '*/10 * * * *',
  $$
  DO $do$
  DECLARE secret text;
  BEGIN
    SELECT substring(command from '"apikey": "([^"]+)"') INTO secret
    FROM cron.job WHERE jobname = 'sla-orders-hourly';
    PERFORM net.http_post(
      url := 'https://project--8e78edb2-4da2-4eba-a854-c653075850d6.lovable.app/api/public/planner/tick',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', coalesce(secret,'')),
      body := '{}'::jsonb
    );
  END
  $do$;
  $$
);