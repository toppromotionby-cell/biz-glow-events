"use client";

// Модалка выбора каталога: разделы берутся из БД (та же навигация, что в шапке и /catalog),
// поэтому новые разделы появляются здесь автоматически.
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CatalogSectionTile, useCatalogNav } from "@/components/catalog/CatalogNav";

type Props =
  | { children: React.ReactNode; open?: undefined; onOpenChange?: undefined }
  | { children?: undefined; open: boolean; onOpenChange: (v: boolean) => void };

export function CatalogChoiceModal(props: Props) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = props.open ?? uncontrolled;
  const setOpen = props.onOpenChange ?? setUncontrolled;
  const sections = useCatalogNav();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.children ? <DialogTrigger asChild>{props.children}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-b from-background to-muted/20 border-border/50">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-display font-bold">Выберите каталог</DialogTitle>
          <DialogDescription className="text-sm">
            Ознакомьтесь с нашими предложениями в нужном разделе
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-2 items-stretch">
          {sections.map((section, i) => (
            <CatalogSectionTile
              key={section.key}
              section={section}
              index={i}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
