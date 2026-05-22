import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Контакты — event-hub.by" }, { name: "description", content: "Свяжитесь с event-hub.by — Минск, Беларусь. Телефон, email." }] }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-display font-bold gradient-text">Контакты</h1>
      <p className="mt-4 text-muted-foreground">Мы на связи с понедельника по субботу, 10:00–20:00.</p>
      <div className="mt-10 grid sm:grid-cols-3 gap-6">
        <a href="tel:+375290000000" className="glass rounded-xl p-6 hover:glow-primary transition">
          <Phone className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Телефон</div>
          <div className="font-medium">+375 (29) 000-00-00</div>
        </a>
        <a href="mailto:hello@event-hub.by" className="glass rounded-xl p-6 hover:glow-primary transition">
          <Mail className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Email</div>
          <div className="font-medium">hello@event-hub.by</div>
        </a>
        <div className="glass rounded-xl p-6">
          <MapPin className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm text-muted-foreground">Адрес</div>
          <div className="font-medium">Минск, Беларусь</div>
        </div>
      </div>
      <div className="mt-12">
        <h2 className="text-2xl font-display font-semibold mb-4">Оставьте заявку</h2>
        <LeadForm source="contacts" />
      </div>
    </div>
  );
}
