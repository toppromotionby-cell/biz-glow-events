// Combobox для выбора категории каталога с возможностью добавлять и удалять.
// Источник данных — таблица public.catalog_categories (scope: entity_type).
// Используется только в админских роутах, на публичный бандл не влияет.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/admin/ConfirmDialog";

type CategoryRow = { id: string; name: string; sort_order: number };

export function CategoryCombobox({
  entityType,
  value,
  onChange,
}: {
  entityType: string;
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { confirm, dialog } = useConfirm();

  const cacheKey = ["catalog-categories", entityType] as const;

  const { data: categories = [], isLoading } = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_categories")
        .select("id,name,sort_order")
        .eq("entity_type", entityType)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Пустое имя");
      const { data, error } = await supabase
        .from("catalog_categories")
        .insert({ entity_type: entityType, name: trimmed })
        .select("id,name,sort_order")
        .single();
      if (error) throw error;
      return data as CategoryRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: cacheKey });
      onChange(row.name);
      setQuery("");
      setOpen(false);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Не удалось добавить";
      toast.error(msg.includes("duplicate") ? "Такая категория уже есть" : msg);
    },
  });

  const remove = useMutation({
    mutationFn: async (row: CategoryRow) => {
      const { error } = await supabase
        .from("catalog_categories")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: cacheKey });
      if (value && value.toLowerCase() === row.name.toLowerCase()) {
        onChange(null);
      }
      toast.success(`Категория «${row.name}» удалена из справочника`);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Не удалось удалить");
    },
  });

  const normalizedQuery = query.trim();
  const exactMatch = useMemo(
    () =>
      categories.some(
        (c) => c.name.toLowerCase() === normalizedQuery.toLowerCase(),
      ),
    [categories, normalizedQuery],
  );

  const label = value || "Выберите категорию";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Поиск или новое имя…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">Загрузка…</div>
            ) : (
              <>
                <CommandEmpty>Ничего не найдено</CommandEmpty>
                {categories.length > 0 && (
                  <CommandGroup heading="Категории">
                    {categories.map((c) => {
                      const isActive =
                        !!value && value.toLowerCase() === c.name.toLowerCase();
                      return (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            onChange(c.name);
                            setOpen(false);
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (remove.isPending) return;
                              if (
                                confirm(
                                  `Удалить категорию «${c.name}» из справочника? Позиции с этим текстом не изменятся.`,
                                )
                              ) {
                                remove.mutate(c);
                              }
                            }}
                            className="opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
                            aria-label={`Удалить ${c.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                {normalizedQuery && !exactMatch && (
                  <>
                    {categories.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        value={`__create__${normalizedQuery}`}
                        onSelect={() => {
                          if (!create.isPending) create.mutate(normalizedQuery);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить «{normalizedQuery}»
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
                {value && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={() => {
                          onChange(null);
                          setOpen(false);
                        }}
                        className="text-muted-foreground"
                      >
                        Очистить выбор
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
