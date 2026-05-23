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
import { Cpu, Music, Lightbulb, Package, ArrowRight, X } from "lucide-react";

const CATALOGS = [
  {
    id: "zones",
    title: "Интерактивные зоны",
    desc: "VR/AR, фотозоны, геймификация, иммерсивные зоны",
    to: "/zones" as const,
    icon: Cpu,
    color: "from-primary to-primary-glow",
  },
  {
    id: "equipment",
    title: "Оборудование",
    desc: "Звук, свет, LED-экраны любых размеров",
    to: "/equipment" as const,
    icon: Music,
    color: "from-accent to-accent-glow",
  },
  {
    id: "services",
    title: "Услуги",
    desc: "BTL, промо-персонал, event-услуги",
    to: "/services" as const,
    icon: Lightbulb,
    color: "from-primary to-accent",
  },
  {
    id: "production",
    title: "Производство",
    desc: "Декорации, баннеры, арт-объекты, реквизит",
    to: "/production" as const,
    icon: Package,
    color: "from-accent to-primary",
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
                <div
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color} mb-0 group-hover:glow-primary transition`}
                >
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
