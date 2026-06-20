
CREATE TABLE IF NOT EXISTS public.document_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  company_legal_name text NOT NULL DEFAULT 'Event Hub',
  company_brand text NOT NULL DEFAULT 'event-hub.by',
  company_unp text NOT NULL DEFAULT '000000000',
  company_address text NOT NULL DEFAULT 'г. Минск, ул. Примерная, 1',
  company_phone text NOT NULL DEFAULT '+375 29 000-00-00',
  company_email text NOT NULL DEFAULT 'hello@event-hub.by',
  company_website text NOT NULL DEFAULT 'event-hub.by',
  logo_url text,
  accent_color text NOT NULL DEFAULT '#6d28d9',
  bank_name text NOT NULL DEFAULT '',
  bank_bic text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT 'BY00 OLMP 0000 0000 0000 0000 0000',
  signer_name text NOT NULL DEFAULT 'Иванов И. И.',
  signer_title text NOT NULL DEFAULT 'директор',
  signer_basis text NOT NULL DEFAULT 'Устава',
  quote_validity_days integer NOT NULL DEFAULT 14,
  quote_footer text NOT NULL DEFAULT 'Предложение действительно 14 дней. Цены указаны без НДС, если иное не оговорено отдельно. Для подтверждения заказа свяжитесь с менеджером.',
  vat_note text NOT NULL DEFAULT 'НДС не облагается (УСН)',
  invoice_validity_days integer NOT NULL DEFAULT 5,
  invoice_footer text NOT NULL DEFAULT 'Счёт действителен 5 банковских дней. Оплата подтверждает согласие с условиями договора оказания услуг. Документ сформирован автоматически и действителен без печати при перечислении средств с р/с плательщика.',
  contract_prepayment_pct numeric NOT NULL DEFAULT 50,
  contract_prepayment_days integer NOT NULL DEFAULT 3,
  contract_cancel_days integer NOT NULL DEFAULT 7,
  contract_late_fee_pct numeric NOT NULL DEFAULT 0.1,
  contract_jurisdiction_city text NOT NULL DEFAULT 'Минск',
  contract_sections jsonb NOT NULL DEFAULT '[
    {"title":"Обязанности сторон","paragraphs":[
      "Исполнитель обязуется: качественно и в срок оказать услуги; обеспечить наличие необходимого оборудования и персонала; соблюдать технику безопасности.",
      "Заказчик обязуется: своевременно предоставить площадку, доступ и необходимую информацию; принять оказанные услуги; произвести оплату в установленные сроки."
    ]},
    {"title":"Ответственность сторон","paragraphs":[
      "За нарушение сроков оплаты Заказчик уплачивает пеню в размере 0,1% от просроченной суммы за каждый день просрочки.",
      "В случае отказа Заказчика от услуг менее чем за 7 дней до даты мероприятия предоплата не возвращается.",
      "Стороны освобождаются от ответственности при наступлении обстоятельств непреодолимой силы (форс-мажор)."
    ]},
    {"title":"Срок действия и прочие условия","paragraphs":[
      "Договор вступает в силу с момента подписания и действует до полного исполнения обязательств сторонами.",
      "Все изменения и дополнения оформляются письменными соглашениями.",
      "Споры разрешаются путём переговоров, при невозможности — в суде по месту нахождения Исполнителя.",
      "Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой стороны."
    ]}
  ]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, UPDATE ON public.document_settings TO authenticated;
GRANT ALL ON public.document_settings TO service_role;

ALTER TABLE public.document_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read document settings"
  ON public.document_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update document settings"
  ON public.document_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_document_settings_updated_at
  BEFORE UPDATE ON public.document_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.document_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
