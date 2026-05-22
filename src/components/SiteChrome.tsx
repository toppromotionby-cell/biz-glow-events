import { Link } from "@tanstack/react-router";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, User, ShoppingCart, Heart, Scale } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useCompare } from "@/lib/compare";
import { SearchTrigger } from "@/components/SearchTrigger";
import { Toggleable } from "@/lib/site-sections";

const NAV = [
  { to: "/zones", label: "Интерактивные Зоны", key: "header.nav.zones" },
  { to: "/equipment", label: "Техническое оснащение", key: "header.nav.equipment" },
  { to: "/services", label: "Услуги", key: "header.nav.services" },
  { to: "/production", label: "Производство", key: "header.nav.production" },
  { to: "/cases", label: "Кейсы", key: "header.nav.cases" },
  { to: "/industries", label: "Индустрии", key: "header.nav.industries" },
  { to: "/testimonials", label: "Отзывы", key: "header.nav.testimonials" },
  { to: "/blog", label: "Блог", key: "header.nav.blog" },
  { to: "/about", label: "О нас", key: "header.nav.about" },
  { to: "/contacts", label: "Контакты", key: "header.nav.contacts" },
] as const;

export function SiteHeader() {
  const { isAuthenticated } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { count: cmpCount } = useCompare();
  return (
    <Toggleable sectionKey="header.root" as="div">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/50">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Перейти к содержимому
        </a>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Toggleable sectionKey="header.brand" as="span">
            <Link to="/" aria-label="event-hub.by — на главную" className="flex items-center gap-2 font-display font-bold text-lg">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary glow-primary" aria-hidden="true">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="gradient-text">event-hub.by</span>
            </Link>
          </Toggleable>
          <Toggleable sectionKey="header.nav" as="span">
            <nav aria-label="Основная навигация" className="hidden md:flex items-center gap-6 text-sm">
              {NAV.map(n => (
                <Toggleable key={n.to} sectionKey={n.key} as="span">
                  <Link to={n.to} className="text-muted-foreground hover:text-foreground transition" activeProps={{ className: "text-foreground" }}>
                    {n.label}
                  </Link>
                </Toggleable>
              ))}
            </nav>
          </Toggleable>
          <div className="flex items-center gap-2">
            <Toggleable sectionKey="header.search" as="span"><SearchTrigger /></Toggleable>
            <Toggleable sectionKey="header.wishlist" as="span">
              <Link to="/wishlist" aria-label={wishCount > 0 ? `Избранное, ${wishCount} позиций` : "Избранное"} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition">
                <Heart className="h-4 w-4" aria-hidden="true" />
                {wishCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">{wishCount}</span>
                )}
              </Link>
            </Toggleable>
            <Toggleable sectionKey="header.compare" as="span">
              <Link to="/compare" aria-label={cmpCount > 0 ? `Сравнение, ${cmpCount} позиций` : "Сравнение"} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition">
                <Scale className="h-4 w-4" aria-hidden="true" />
                {cmpCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">{cmpCount}</span>
                )}
              </Link>
            </Toggleable>
            <Toggleable sectionKey="header.cart" as="span">
              <Link to="/cart" aria-label={count > 0 ? `Корзина, ${count} позиций` : "Корзина"} className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">{count}</span>
                )}
              </Link>
            </Toggleable>
            {isAuthenticated ? (
              <>
                <Toggleable sectionKey="header.account" as="span">
                  <Link to="/profile"><Button variant="ghost" size="sm"><User className="h-4 w-4 mr-1" />Кабинет</Button></Link>
                </Toggleable>
                <Toggleable sectionKey="header.logout" as="span">
                  <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Выйти</Button>
                </Toggleable>
              </>
            ) : (
              <>
                <Toggleable sectionKey="header.login" as="span">
                  <Link to="/login"><Button variant="ghost" size="sm">Войти</Button></Link>
                </Toggleable>
                <Toggleable sectionKey="header.register" as="span">
                  <Link to="/register"><Button size="sm" className="bg-gradient-primary glow-primary">Регистрация</Button></Link>
                </Toggleable>
              </>
            )}
          </div>
        </div>
      </header>
    </Toggleable>
  );
}

export function SiteFooter() {
  return (
    <Toggleable sectionKey="footer.root" as="div">
      <footer className="border-t border-border/50 mt-20">
        <div className="container mx-auto px-4 py-10 grid md:grid-cols-4 gap-8 text-sm">
          <Toggleable sectionKey="footer.brand" as="div">
            <div className="font-display font-bold text-lg gradient-text">event-hub.by</div>
            <p className="text-muted-foreground mt-2">Event-технологии и продакшн в Беларуси. Минск.</p>
          </Toggleable>
          <Toggleable sectionKey="footer.catalog" as="div">
            <h4 className="font-medium mb-3">Каталог</h4>
            <ul className="space-y-2 text-muted-foreground">
              {NAV.map(n => <li key={n.to}><Link to={n.to} className="hover:text-foreground">{n.label}</Link></li>)}
            </ul>
          </Toggleable>
          <Toggleable sectionKey="footer.info" as="div">
            <h4 className="font-medium mb-3">Информация</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link to="/partners" className="hover:text-foreground">Агентствам</Link></li>
              <li><Link to="/calculator" className="hover:text-foreground">Калькулятор сметы</Link></li>
              <li><Link to="/delivery" className="hover:text-foreground">Доставка и оплата</Link></li>
              <li><Link to="/faq" className="hover:text-foreground">Частые вопросы</Link></li>
              <li><Link to="/terms-rental" className="hover:text-foreground">Условия аренды</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground">Политика конфиденциальности</Link></li>
              <li><Link to="/offer" className="hover:text-foreground">Публичная оферта</Link></li>
            </ul>
          </Toggleable>
          <Toggleable sectionKey="footer.contacts" as="div">
            <h4 className="font-medium mb-3">Контакты</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>Минск, Беларусь</li>
              <li><a href="tel:+375290000000" className="hover:text-foreground">+375 (29) 000-00-00</a></li>
              <li><a href="mailto:hello@event-hub.by" className="hover:text-foreground">hello@event-hub.by</a></li>
            </ul>
            <Toggleable sectionKey="footer.newsletter" as="div" className="mt-5">
              <h4 className="font-medium mb-2 text-foreground">Рассылка</h4>
              <p className="text-xs text-muted-foreground mb-2">Кейсы, новые зоны и спецпредложения — раз в месяц.</p>
              <NewsletterSignup />
            </Toggleable>
          </Toggleable>
        </div>
        <Toggleable sectionKey="footer.copyright" as="div" className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} event-hub.by. Все права защищены.
        </Toggleable>
      </footer>
    </Toggleable>
  );
}
