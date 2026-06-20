ALTER TABLE public.document_settings
  ADD COLUMN IF NOT EXISTS act_validity_days int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS act_intro text NOT NULL DEFAULT 'Настоящий Акт составлен о том, что Исполнитель оказал, а Заказчик принял услуги в полном объёме и надлежащего качества. Стороны претензий друг к другу не имеют.',
  ADD COLUMN IF NOT EXISTS act_footer text NOT NULL DEFAULT 'Акт подлежит подписанию обеими сторонами в течение 5 рабочих дней. При отсутствии мотивированных возражений в указанный срок услуги считаются принятыми.';