import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail, FileText } from "lucide-react";
import { CONTACT } from "@/lib/contacts";

export const Route = createFileRoute("/order/success/$id")({
  component: OrderSuccess,
  head: () => ({
    meta: [
      { title: "Заказ оформлен — event-hub.by" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function OrderSuccess() {
  const { id } = Route.useParams();
  const short = id.slice(0, 8).toUpperCase();
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <div className="glass-strong rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Заявка принята</h1>
          <p className="mt-2 text-muted-foreground">
            Номер заявки: <span className="font-mono text-foreground">#{short}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Менеджер свяжется с вами в течение рабочего дня для уточнения деталей и подготовки документов.
          На указанный email придёт подтверждение.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 text-left">
          <a href={`mailto:${CONTACT.email}`} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 border border-transparent transition">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm font-medium">{CONTACT.email}</div>
            </div>
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link to="/profile" className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-5 py-2.5 text-sm font-medium hover:bg-primary/10 transition">
            <FileText className="h-4 w-4" /> Мои заявки
          </Link>
          <Link to="/" className="inline-flex items-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
