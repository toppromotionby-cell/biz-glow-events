ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until_override date;

DROP TRIGGER IF EXISTS set_quote_number_upd_trg ON public.quotes;
CREATE TRIGGER set_quote_number_upd_trg
BEFORE UPDATE ON public.quotes
FOR EACH ROW
WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
EXECUTE FUNCTION public.set_quote_number();