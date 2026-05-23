"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gamepad2, Settings2, CalendarCheck, Package, ArrowRight, X } from "lucide-react";

const CATALOGS = [
  {
    id: "zones",
    title: "Интерактивные зоны",
    desc: "VR/AR, геймификация, фотозоны и иммерсивные активности",
    to: "/zones" as const,
    icon: Gamepad2,
  },
  {
    id: "equipment",
    title: "Техническое оснащение мероприятий",
    desc: "Звук, свет, LED-экраны и сцена под ключ",
    to: "/equipment" as const,
    icon: Settings2,
  },
  {
    id: "services",
    title: "Организация мероприятий под ключ",
    desc: "Концепция, площадка, подрядчики, монтаж, координация — мы берём всё",
    to: "/services" as const,
    icon: CalendarCheck,
  },
  {
    id: "production",
    title: "Производство",
    desc: "Декорации, баннеры, арт-объекты, реквизит",
    to: "/production" as const,
    icon: Package,
  },
];

export function CatalogChoiceModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-background to-muted/20 border-border/50">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl font-display font-bold">
            Выберите каталог
          </DialogTitle>
          <DialogDescription>
            Ознакомьтесь с нашими предложениями в нужном разделе
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {CATALOGS.map((cat) => (
            <Link
              key={cat.id}
              to={cat.to}
              onClick={() => setOpen(false)}
              className="group relative glass rounded-xl p-5 hover:border-primary/50 transition-all duration-200 block"
            >
              <div className="flex items-start gap-4">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary mb-0 group-hover:glow-primary transition">
                  <cat.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight group-hover:text-primary transition">
                    {cat.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {cat.desc}
                  </p>
                  <div className="mt-2 inline-flex items-center text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Перейти <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-3 w-3" /> Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
