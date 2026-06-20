
-- 1) Колонка
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text;

-- 2) Индекс по дате создания в таймзоне Минска
CREATE INDEX IF NOT EXISTS orders_created_day_minsk_idx
  ON public.orders (((created_at AT TIME ZONE 'Europe/Minsk')::date));

-- 3) Функция генерации номера
CREATE OR REPLACE FUNCTION public.generate_order_number(p_created timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (p_created AT TIME ZONE 'Europe/Minsk')::date;
  v_count int;
  v_seq int;
  v_num text;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.orders
   WHERE (created_at AT TIME ZONE 'Europe/Minsk')::date = v_day;
  v_seq := v_count + 1;
  v_num := to_char(v_day, 'DD/MM/YYYY') || '-' || lpad(v_seq::text, 2, '0');
  RETURN v_num;
END;
$$;

-- 4) Триггер BEFORE INSERT с защитой от гонок
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date;
  v_seq int;
  v_attempt int := 0;
  v_candidate text;
  v_exists boolean;
BEGIN
  IF NEW.order_number IS NOT NULL AND NEW.order_number <> '' THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.created_at AT TIME ZONE 'Europe/Minsk')::date;

  SELECT count(*) INTO v_seq
    FROM public.orders
   WHERE (created_at AT TIME ZONE 'Europe/Minsk')::date = v_day;
  v_seq := v_seq + 1;

  LOOP
    v_candidate := to_char(v_day, 'DD/MM/YYYY') || '-' || lpad(v_seq::text, 2, '0');
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = v_candidate) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempt > 50;
    v_seq := v_seq + 1;
    v_attempt := v_attempt + 1;
  END LOOP;

  NEW.order_number := v_candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_number_trg ON public.orders;
CREATE TRIGGER set_order_number_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- 5) Бэкфилл существующих
WITH ranked AS (
  SELECT id,
         (created_at AT TIME ZONE 'Europe/Minsk')::date AS d,
         row_number() OVER (
           PARTITION BY (created_at AT TIME ZONE 'Europe/Minsk')::date
           ORDER BY created_at, id
         ) AS rn
    FROM public.orders
   WHERE order_number IS NULL
)
UPDATE public.orders o
   SET order_number = to_char(r.d, 'DD/MM/YYYY') || '-' || lpad(r.rn::text, 2, '0')
  FROM ranked r
 WHERE o.id = r.id;

-- 6) Уникальность
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique ON public.orders (order_number);
