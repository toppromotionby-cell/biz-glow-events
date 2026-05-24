import { Link } from "@tanstack/react-router";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, User, ShoppingCart, Heart, Scale, Menu } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useCompare } from "@/lib/compare";
import { SearchTrigger } from "@/components/SearchTrigger";
import { Toggleable } from "@/lib/site-sections";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader, SheetClose } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CONTACT } from "@/lib/contacts";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { to: "/zones", label: "Интерактивные Зоны", key: "header.nav.zones", footerKey: "footer.catalog.zones" },
  { to: "/equipment", label: "Техническое оснащение", key: "header.nav.equipment", footerKey: "footer.catalog.equipment" },
  { to: "/services", label: "Услуги", key: "header.nav.services", footerKey: "footer.catalog.services" },
  { to: "/production", label: "Производство", key: "header.nav.production", footerKey: "footer.catalog.production" },
  { to: "/cases", label: "Кейсы", key: "header.nav.cases", footerKey: "footer.catalog.cases" },
  { to: "/industries", label: "Индустрии", key: "header.nav.industries", footerKey: "footer.catalog.industries" },
  { to: "/testimonials", label: "Отзывы", key: "header.nav.testimonials", footerKey: "footer.catalog.testimonials" },
  { to: "/blog", label: "Блог", key: "header.nav.blog", footerKey: "footer.catalog.blog" },
  { to: "/about", label: "О нас", key: "header.nav.about", footerKey: "footer.catalog.about" },
  { to: "/contacts", label: "Контакты", key: "header.nav.contacts", footerKey: "footer.catalog.contacts_link" },
] as const;

const INFO_LINKS = [
  { to: "/partners", label: "Агентствам", footerKey: "footer.info.partners" },
  { to: "/calculator", label: "Калькулятор сметы", footerKey: "footer.info.calculator" },
  { to: "/delivery", label: "Доставка и оплата", footerKey: "footer.info.delivery" },
  { to: "/faq", label: "Частые вопросы", footerKey: "footer.info.faq" },
  { to: "/terms-rental", label: "Условия аренды", footerKey: "footer.info.terms" },
  { to: "/privacy", label: "Политика конфиденциальности", footerKey: "footer.info.privacy" },
  { to: "/offer", label: "Публичная оферта", footerKey: "footer.info.offer" },
] as const;

export function SiteHeader() {
  const { isAuthenticated } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { count: cmpCount } = useCompare();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Toggleable sectionKey="header.root" as="div">
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className="sticky top-0 z-40 glass-strong border-b border-border/50 transition-[height,backdrop-filter] duration-200"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          Перейти к содержимому
        </a>
        <div className={`container mx-auto px-4 flex items-center justify-between gap-2 md:gap-4 transition-all duration-200 ${scrolled ? "h-12 md:h-14" : "h-16"}`}>
          <Toggleable sectionKey="header.brand" as="span">
            <Link to="/" aria-label="event-hub.by — на главную" className="flex items-center gap-2 font-display font-bold text-lg whitespace-nowrap shrink-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary glow-primary shrink-0" aria-hidden="true">
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

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
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

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1">
            
            <Toggleable sectionKey="header.search" as="span"><SearchTrigger /></Toggleable>
            <Toggleable sectionKey="header.cart" as="span">
              <Link to="/cart" aria-label={count > 0 ? `Корзина, ${count} позиций` : "Корзина"} className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-primary/10 transition">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {count > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">{count}</span>
                )}
              </Link>
            </Toggleable>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Открыть меню"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-primary/10 transition"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0 flex flex-col">
                <SheetHeader className="px-5 pt-5">
                  <SheetTitle className="font-display gradient-text text-xl">event-hub.by</SheetTitle>
                </SheetHeader>

                <Toggleable sectionKey="header.nav" as="div">
                  <nav aria-label="Мобильная навигация" className="px-2 pb-4 flex flex-col">
                    {NAV.map((n) => (
                      <Toggleable key={n.to} sectionKey={n.key} as="div">
                        <SheetClose asChild>
                          <Link
                            to={n.to}
                            className="block px-3 py-3 rounded-md text-base text-foreground hover:bg-primary/10 transition"
                            activeProps={{ className: "bg-primary/15 text-foreground" }}
                          >
                            {n.label}
                          </Link>
                        </SheetClose>
                      </Toggleable>
                    ))}
                  </nav>
                </Toggleable>

                <div className="border-t border-border/50 px-2 py-3">
                  <div className="px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground">Быстрые действия</div>
                  <Toggleable sectionKey="header.wishlist" as="div">
                    <SheetClose asChild>
                      <Link to="/wishlist" className="flex items-center justify-between px-3 py-3 rounded-md hover:bg-primary/10 transition">
                        <span className="flex items-center gap-3"><Heart className="h-4 w-4" /> Избранное</span>
                        {wishCount > 0 && <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{wishCount}</span>}
                      </Link>
                    </SheetClose>
                  </Toggleable>
                  <Toggleable sectionKey="header.compare" as="div">
                    <SheetClose asChild>
                      <Link to="/compare" className="flex items-center justify-between px-3 py-3 rounded-md hover:bg-primary/10 transition">
                        <span className="flex items-center gap-3"><Scale className="h-4 w-4" /> Сравнение</span>
                        {cmpCount > 0 && <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{cmpCount}</span>}
                      </Link>
                    </SheetClose>
                  </Toggleable>
                  {/* Калькулятор сметы убран из быстрых действий мобильного меню */}
                </div>

                <div className="mt-auto border-t border-border/50 p-4 flex flex-col gap-2" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
                  {isAuthenticated ? (
                    <>
                      <Toggleable sectionKey="header.account" as="div">
                        <SheetClose asChild>
                          <Link to="/profile"><Button variant="outline" className="w-full"><User className="h-4 w-4 mr-2" />Личный кабинет</Button></Link>
                        </SheetClose>
                      </Toggleable>
                      <Toggleable sectionKey="header.logout" as="div">
                        <Button variant="ghost" className="w-full" onClick={() => { supabase.auth.signOut(); setOpen(false); }}>Выйти</Button>
                      </Toggleable>
                    </>
                  ) : (
                    <>
                      <Toggleable sectionKey="header.login" as="div">
                        <SheetClose asChild>
                          <Link to="/login"><Button variant="outline" className="w-full">Войти</Button></Link>
                        </SheetClose>
                      </Toggleable>
                      <Toggleable sectionKey="header.register" as="div">
                        <SheetClose asChild>
                          <Link to="/register"><Button className="w-full bg-gradient-primary glow-primary">Регистрация</Button></Link>
                        </SheetClose>
                      </Toggleable>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
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
        <div className="container mx-auto px-4 py-10 text-sm">
          {/* Desktop layout */}
          <div className="hidden md:grid md:grid-cols-4 gap-8">
            <Toggleable sectionKey="footer.brand" as="div">
              <div className="font-display font-bold text-lg gradient-text">event-hub.by</div>
              <p className="text-muted-foreground mt-2">Event-технологии и продакшн в Беларуси. Минск.</p>
            </Toggleable>
            <Toggleable sectionKey="footer.catalog" as="div">
              <h4 className="font-medium mb-3">Каталог</h4>
              <ul className="space-y-2 text-muted-foreground">
                {NAV.map(n => (
                  <Toggleable key={n.to} sectionKey={n.footerKey} as="li">
                    <Link to={n.to} className="hover:text-foreground">{n.label}</Link>
                  </Toggleable>
                ))}
              </ul>
            </Toggleable>
            <Toggleable sectionKey="footer.info" as="div">
              <h4 className="font-medium mb-3">Информация</h4>
              <ul className="space-y-2 text-muted-foreground">
                {INFO_LINKS.map(l => (
                  <Toggleable key={l.to} sectionKey={l.footerKey} as="li">
                    <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
                  </Toggleable>
                ))}
              </ul>
            </Toggleable>
            <Toggleable sectionKey="footer.contacts" as="div">
              <h4 className="font-medium mb-3">Контакты</h4>
              <ul className="space-y-2 text-muted-foreground">
                <Toggleable sectionKey="footer.contacts.address" as="li">{CONTACT.address}</Toggleable>
                <Toggleable sectionKey="footer.contacts.email" as="li"><a href={`mailto:${CONTACT.email}`} className="hover:text-foreground">{CONTACT.email}</a></Toggleable>
              </ul>
              <Toggleable sectionKey="footer.newsletter" as="div" className="mt-5">
                <h4 className="font-medium mb-2 text-foreground">Рассылка</h4>
                <p className="text-xs text-muted-foreground mb-2">Кейсы, новые зоны и спецпредложения — раз в месяц.</p>
                <NewsletterSignup />
              </Toggleable>
            </Toggleable>
          </div>

          {/* Mobile layout */}
          <div className="md:hidden flex flex-col gap-4">
            <Toggleable sectionKey="footer.brand" as="div">
              <div className="font-display font-bold text-lg gradient-text">event-hub.by</div>
              <p className="text-muted-foreground mt-2">Event-технологии и продакшн в Беларуси. Минск.</p>
            </Toggleable>

            <Accordion type="multiple" className="w-full">
              <Toggleable sectionKey="footer.catalog" as="div">
                <AccordionItem value="catalog">
                  <AccordionTrigger className="py-3">Каталог</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-muted-foreground pb-2">
                      {NAV.map(n => (
                        <Toggleable key={n.to} sectionKey={n.footerKey} as="li">
                          <Link to={n.to} className="hover:text-foreground">{n.label}</Link>
                        </Toggleable>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Toggleable>
              <Toggleable sectionKey="footer.info" as="div">
                <AccordionItem value="info">
                  <AccordionTrigger className="py-3">Информация</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-muted-foreground pb-2">
                      {INFO_LINKS.map(l => (
                        <Toggleable key={l.to} sectionKey={l.footerKey} as="li">
                          <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
                        </Toggleable>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Toggleable>
              <Toggleable sectionKey="footer.contacts" as="div">
                <AccordionItem value="contacts">
                  <AccordionTrigger className="py-3">Контакты</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-muted-foreground pb-2">
                      <Toggleable sectionKey="footer.contacts.address" as="li">{CONTACT.address}</Toggleable>
                      <Toggleable sectionKey="footer.contacts.email" as="li"><a href={`mailto:${CONTACT.email}`} className="hover:text-foreground">{CONTACT.email}</a></Toggleable>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Toggleable>
            </Accordion>

            <Toggleable sectionKey="footer.newsletter" as="div">
              <h4 className="font-medium mb-2 text-foreground">Рассылка</h4>
              <p className="text-xs text-muted-foreground mb-2">Кейсы, новые зоны и спецпредложения — раз в месяц.</p>
              <NewsletterSignup />
            </Toggleable>
          </div>
        </div>
        <Toggleable sectionKey="footer.copyright" as="div" className="border-t border-border/50 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} event-hub.by. Все права защищены.
        </Toggleable>
      </footer>
    </Toggleable>
  );
}
