-- lovable-cron-fallback-reviewed: 144 runs/day; рассылка очереди уведомлений диджей-бота, часовая сводка отклонений и дайджесты по расписанию — событийных триггеров для наступления момента времени нет
SELECT cron.schedule(
  'dj-telegram-tick',
  '*/10 * * * *',
  $$
  DO $do$
  DECLARE secret text;
  BEGIN
    SELECT substring(command from '"apikey": "([^"]+)"') INTO secret
    FROM cron.job WHERE jobname = 'sla-orders-hourly';
    PERFORM net.http_post(
      url := 'https://project--8e78edb2-4da2-4eba-a854-c653075850d6.lovable.app/api/public/dj/tick',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', coalesce(secret,'')),
      body := '{}'::jsonb
    );
  END
  $do$;
  $$
);