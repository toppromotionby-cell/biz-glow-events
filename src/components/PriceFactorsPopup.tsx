// Прозрачное ценообразование: попап «Что влияет на цену».
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Info, Calendar, Clock, MapPin, Wrench, Users, Sparkles } from "lucide-react";

const FACTORS = [
  { icon: Calendar, title: "Дата и сезонность", text: "Пиковые даты (НГ, выпускные, май) — выше; будни и низкий сезон — ниже." },
  { icon: Clock, title: "Длительность", text: "Кратчайший слот — почасовая, длиннее — пакетная скидка до −20%." },
  { icon: MapPin, title: "Локация и доставка", text: "Минск в пределах МКАД — бесплатно. Регионы — по тарифу + командировочные." },
  { icon: Wrench, title: "Комплектация и сложность", text: "Базовый или расширенный пакет: декор, аниматор, оператор, кастомизация." },
  { icon: Users, title: "Количество гостей", text: "Чем больше людей — тем больше расходников и операторов в смене." },
  { icon: Sparkles, title: "Брендирование и кастом", text: "Логотип, фирменные цвета, индивидуальный дизайн — отдельная работа." },
];

export function PriceFactorsPopup({ trigger }: { trigger?: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            <Info className="h-3.5 w-3.5" />
            Что влияет на цену?
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogTitle className="font-display text-xl">Что влияет на финальную цену</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Цена «от» — это базовая позиция. Точную сумму считает менеджер с учётом 6 факторов:
        </DialogDescription>
        <ul className="mt-2 space-y-3">
          {FACTORS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{text}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg bg-primary/10 p-3 text-xs text-foreground/90">
          💡 Бесплатный расчёт за 1 час — оставьте заявку, и менеджер пришлёт точную смету на e-mail.
        </div>
      </DialogContent>
    </Dialog>
  );
}
