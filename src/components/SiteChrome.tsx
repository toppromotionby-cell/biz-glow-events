import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, User } from "lucide-react";

const NAV = [
  { to: "/zones", label: "Зоны" },
  { to: "/equipment", label: "Оборудование" },
  { to: "/services", label: "Услуги" },
  { to: "/production", label: "Производство" },
  { to: "/contacts", label: "Контакты" },
] as const;

export function SiteHeader() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-40 glass-strong border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary glow-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="gradient-text">event-hub.by</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV.map(n => (
            <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-foreground transition" activeProps={{ className: "text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link to="/profile"><Button variant="ghost" size="sm"><User className="h-4 w-4 mr-1" />Кабинет</Button></Link>
              <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Выйти</Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Войти</Button></Link>
              <Link to="/register"><Button size="sm" className="bg-gradient-primary glow-primary">Регистрация</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 mt-20">
      <div className="container mx-auto px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-display font-bold text-lg gradient-text">event-hub.by</div>
          <p className="text-muted-foreground mt-2">Event-технологии и продакшн в Беларуси. Минск.</p>
        </div>
        <div>
          <h4 className="font-medium mb-3">Каталог</h4>
          <ul className="space-y-2 text-muted-foreground">
            {NAV.map(n => <li key={n.to}><Link to={n.to} className="hover:text-foreground">{n.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-3">Документы</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Политика конфиденциальности</Link></li>
            <li><Link to="/offer" className="hover:text-foreground">Публичная оферта</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-3">Контакты</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>Минск, Беларусь</li>
            <li><a href="tel:+375290000000" className="hover:text-foreground">+375 (29) 000-00-00</a></li>
            <li><a href="mailto:hello@event-hub.by" className="hover:text-foreground">hello@event-hub.by</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} event-hub.by. Все права защищены.
      </div>
    </footer>
  );
}
