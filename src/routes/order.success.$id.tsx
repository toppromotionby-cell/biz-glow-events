import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Mail, FileText, Phone, Send, UserPlus } from "lucide-react";
import { CONTACT } from "@/lib/contacts";
import { supabase } from "@/integrations/supabase/client";
import { displayOrderNumber } from "@/lib/order-number";
import { useAuth } from "@/hooks/use-auth";


export const Route = createFileRoute("/order/success/$id")({
  component: OrderSuccess,
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Заказ оформлен — event-hub.by" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function OrderSuccess() {
  const { id } = Route.useParams();
  const { t: token } = Route.useSearch();
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ["order-success-number", id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id, order_number").eq("id", id).maybeSingle();
      return data;
    },
  });
  const label = displayOrderNumber(data ?? { id });
  return (
    <div className="page-shell section-y max-w-2xl">
      <div className="glass-strong rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Заявка принята</h1>
          <p className="mt-2 text-muted-foreground">
            Номер заявки: <span className="font-mono text-foreground">{label}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Менеджер свяжется с вами в течение рабочего дня для уточнения деталей и подготовки документов.
          На указанный email придёт подтверждение.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 text-left">
          <a href={`tel:${CONTACT.phoneTel}`} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 border border-transparent transition">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Телефон</div>
              <div className="text-sm font-medium">{CONTACT.phoneDisplay}</div>
            </div>
          </a>
          <a href={CONTACT.telegramUrl} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 border border-transparent transition">
            <Send className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Telegram</div>
              <div className="text-sm font-medium">{CONTACT.telegramLabel}</div>
            </div>
          </a>
          <a href={`mailto:${CONTACT.email}`} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 border border-transparent transition sm:col-span-2">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm font-medium">{CONTACT.email}</div>
            </div>
          </a>
        </div>

        {token && (
          <div className="glass rounded-xl p-4 text-left space-y-2">
            <div className="text-sm font-medium">Кабинет заказа доступен сразу</div>
            <p className="text-xs text-muted-foreground">
              Статус, состав и документы по этому заказу — без регистрации, по личной ссылке.
              Сохраните её: мы также продублировали ссылку в письме.
            </p>
            <Link
              to="/my/$token"
              params={{ token }}
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary"
            >
              <FileText className="h-4 w-4" /> Открыть мой заказ
            </Link>
          </div>
        )}

        {!isAuthenticated && (
          <div className="glass rounded-xl p-4 text-left space-y-2">
            <div className="text-sm font-medium">Личный кабинет уже создан</div>
            <p className="text-xs text-muted-foreground">
              Мы отправили данные для входа на указанный email — там история заказов, документы
              и повторный заказ в один клик.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary"
            >
              <UserPlus className="h-4 w-4" /> Войти в кабинет
            </Link>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {isAuthenticated && (
            <Link to="/profile" className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-5 py-2.5 text-sm font-medium hover:bg-primary/10 transition">
              <FileText className="h-4 w-4" /> Мои заявки
            </Link>
          )}
          <Link to="/" className="inline-flex items-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
            На главную
          </Link>
        </div>

      </div>
    </div>
  );
}
