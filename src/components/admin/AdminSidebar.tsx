// Адаптивный сайдбар админки на базе shadcn Sidebar (collapsible="icon").
// Состояние свёрнутости сохраняется в cookie самим SidebarProvider.
// На мобильных превращается в off-canvas drawer.
import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingCart, Calendar, Package, FileText,
  Megaphone, Newspaper, UserCog, Trophy, MessageSquareQuote,
  CalendarClock, Tag, ToggleRight, LogOut, ChevronDown, Mail,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type BadgeKey = "newOrders" | "todayBookings" | "pendingTestimonials";
type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badgeKey?: BadgeKey };
type NavGroup = { label: string; items: NavItem[] };


const GROUPS: NavGroup[] = [
  {
    label: "Операции",
    items: [
      { to: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
      { to: "/admin/orders", label: "Заказы (CRM)", icon: ShoppingCart, badgeKey: "newOrders" },
      { to: "/admin/calendar", label: "Календарь", icon: Calendar, badgeKey: "todayBookings" },
      { to: "/admin/availability", label: "Занятость", icon: CalendarClock },
    ],
  },
  {
    label: "Контент",
    items: [
      { to: "/admin/catalog/zones", label: "Наполнение", icon: Package },
      { to: "/admin/cases", label: "Кейсы", icon: Trophy },
      { to: "/admin/testimonials", label: "Отзывы", icon: MessageSquareQuote, badgeKey: "pendingTestimonials" },
      { to: "/admin/blog", label: "Блог", icon: Newspaper },
    ],
  },
  {
    label: "Маркетинг",
    items: [
      { to: "/admin/marketing", label: "Маркетинг", icon: Megaphone },
      { to: "/admin/campaigns", label: "Email-рассылки", icon: Mail },
      { to: "/admin/promo", label: "Промокоды", icon: Tag },
    ],
  },
  {
    label: "Система",
    items: [
      { to: "/admin/users", label: "Пользователи", icon: UserCog },
      { to: "/admin/sections", label: "Видимость секций", icon: ToggleRight },
      { to: "/admin/audit", label: "Аудит", icon: FileText },
    ],
  },
];

function useSidebarBadges() {
  return useQuery({
    queryKey: ["admin-sidebar-badges"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<BadgeKey, number>> => {
      const today = new Date().toISOString().slice(0, 10);
      const [newOrders, todayBookings, pendingTestimonials] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new" as any),
        supabase.from("availability").select("id", { count: "exact", head: true }).lte("start_date", today).gte("end_date", today),
        supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("published", false),
      ]);
      return {
        newOrders: newOrders.count ?? 0,
        todayBookings: todayBookings.count ?? 0,
        pendingTestimonials: pendingTestimonials.count ?? 0,
      };
    },
  });
}


function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  // catalog/zones is one of variants — активен любой catalog подпуть
  if (item.to.startsWith("/admin/catalog/")) return pathname.startsWith("/admin/catalog");
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

export function AdminSidebar() {
  const loc = useLocation();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { user } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="gap-0 pt-14">
        {GROUPS.map((group) => {
          const hasActive = group.items.some((i) => isItemActive(loc.pathname, i));
          return (
            <NavSection
              key={group.label}
              group={group}
              pathname={loc.pathname}
              collapsed={collapsed}
              defaultOpen={hasActive}
            />
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={user?.email ?? "Профиль"}
              className="cursor-default hover:bg-transparent"
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground">
                {(user?.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {user?.email ?? "—"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Выйти"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavSection({
  group, pathname, collapsed, defaultOpen,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // В collapsed-режиме группы всегда «раскрыты» как иконки — без обёртки Collapsible
  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map((item) => (
              <NavLinkRow key={item.to} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={cn(
              "group/label cursor-pointer flex items-center justify-between text-[11px] uppercase tracking-wider",
              "hover:text-foreground transition",
            )}
          >
            <span>{group.label}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavLinkRow key={item.to} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function NavLinkRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isItemActive(pathname, item);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          active && "bg-gradient-primary text-primary-foreground hover:bg-gradient-primary hover:text-primary-foreground",
        )}
      >
        <Link to={item.to}>
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
