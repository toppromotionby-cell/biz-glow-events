import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin, MessageCircle, Send } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { CONTACT } from "@/lib/contacts";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Контакты — event-hub.by" }, { name: "description", content: "Свяжитесь с event-hub.by — Минск, Беларусь. Телефон, WhatsApp, Telegram, email." }] }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-display font-bold gradient-text">Контакты</h1>
      <p className="mt-4 text-muted-foreground">Мы на связи {CONTACT.hours.toLowerCase()}.</p>
      <div className="mt-10 grid sm:grid-cols-2 gap-4">
        <a href={`tel:${CONTACT.phoneTel}`} className="glass rounded-xl p-6 hover:glow-primary transition">
          <Phone className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Телефон</div>
          <div className="font-medium">{CONTACT.phoneDisplay}</div>
        </a>
        <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-6 hover:glow-primary transition">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">WhatsApp</div>
          <div className="font-medium">Написать в WhatsApp</div>
        </a>
        <a href={CONTACT.telegram} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-6 hover:glow-primary transition">
          <Send className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Telegram</div>
          <div className="font-medium">Написать в Telegram</div>
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
      </div>
      <div className="mt-12">
        <h2 className="text-2xl font-display font-semibold mb-4">Оставьте заявку</h2>
        <LeadForm source="contacts" />
      </div>
    </div>
  );
}
