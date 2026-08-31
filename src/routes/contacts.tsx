import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Send, Instagram } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { CONTACT } from "@/lib/contacts";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { trackSocialClick } from "@/lib/analytics";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Контакты — event-hub.by" },
      { name: "description", content: "Свяжитесь с event-hub.by: офис в Минске, email и форма заявки. Подберём оборудование, зоны и услуги под ваше мероприятие в Беларуси." },
      { property: "og:title", content: "Контакты event-hub.by — Минск, Беларусь" },
      { property: "og:description", content: "Напишите нам или оставьте заявку — поможем подобрать оборудование, площадки и услуги для вашего мероприятия." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { instagram_url, tiktok_url } = useSiteSettings();
  return (
    <div className="page-shell section-y max-w-3xl">
      <h1 className="text-4xl font-display font-bold gradient-text">Контакты</h1>
      <p className="mt-4 text-muted-foreground">Мы на связи {CONTACT.hours.toLowerCase()}.</p>
      <div className="mt-10 grid sm:grid-cols-2 gap-4">
        <a href={`tel:${CONTACT.phoneTel}`} className="glass rounded-xl p-6 hover:glow-primary transition">
          <Phone className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Телефон</div>
          <div className="font-medium">{CONTACT.phoneDisplay}</div>
        </a>
        <a href={CONTACT.telegramUrl} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-6 hover:glow-primary transition">
          <Send className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Telegram</div>
          <div className="font-medium">{CONTACT.telegramLabel}</div>
        </a>
        <a href={`mailto:${CONTACT.email}`} className="glass rounded-xl p-6 hover:glow-primary transition">
          <Mail className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Email</div>
          <div className="font-medium">{CONTACT.email}</div>
        </a>
        <div className="glass rounded-xl p-6 sm:col-span-2">
          <MapPin className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Адрес</div>
          <div className="font-medium">{CONTACT.address}</div>
        </div>
        {instagram_url && (
          <a
            href={instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-6 hover:glow-primary transition"
            aria-label="Мы в Instagram"
            onClick={() => trackSocialClick("instagram", "contacts_page", instagram_url)}
          >
            <Instagram className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm text-muted-foreground">Instagram</div>
            <div className="font-medium truncate">{instagram_url.replace(/^https?:\/\//, "")}</div>
          </a>
        )}
        {tiktok_url && (
          <a
            href={tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-6 hover:glow-primary transition"
            aria-label="Мы в TikTok"
            onClick={() => trackSocialClick("tiktok", "contacts_page", tiktok_url)}
          >
            <TikTokIcon size={20} className="text-primary" />
            <div className="mt-3 text-sm text-muted-foreground">TikTok</div>
            <div className="font-medium truncate">{tiktok_url.replace(/^https?:\/\//, "")}</div>
          </a>
        )}
      </div>
      <div className="mt-12">
        <h2 className="text-2xl font-display font-semibold mb-4">Оставьте заявку</h2>
        <LeadForm source="contacts" />
      </div>
    </div>
  );
}
