// Плавающий виджет связи: Онлайн-помощник (для авторизованных) + Telegram + Звонок.
// Видим на всех страницах, уважает настройку секции global.floating_contacts.
import { useState } from "react";
import { MessageCircle, Send, X, Phone, Headphones } from "lucide-react";
import { CONTACT } from "@/lib/contacts";
import { useSectionEnabled } from "@/lib/site-sections";
import { useAuth } from "@/hooks/use-auth";
import { SupportChat } from "@/components/SupportChat";

export function FloatingContacts() {
  const enabled = useSectionEnabled("global.floating_contacts");
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  if (!enabled) return null;

  return (
    <>
      <SupportChat open={chatOpen} onClose={() => setChatOpen(false)} hideTrigger />
      <div
        className="fixed z-40 right-4 sm:right-6"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        aria-live="polite"
      >
        {open && !chatOpen && (
          <div className="mb-3 flex flex-col gap-2 items-end animate-in fade-in slide-in-from-bottom-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => { setChatOpen(true); setOpen(false); }}
                aria-label="Открыть онлайн-помощника"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground pl-3 pr-4 py-2 shadow-lg hover:scale-105 transition"
              >
                <Headphones className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">Онлайн-помощник</span>
              </button>
            )}
            <a
              href={CONTACT.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать в Telegram"
              className="group inline-flex items-center gap-2 rounded-full bg-[#229ED9] text-white pl-3 pr-4 py-2 shadow-lg hover:scale-105 transition"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Telegram</span>
            </a>
            <a
              href={`tel:${CONTACT.phoneTel}`}
              aria-label="Позвонить"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground text-background pl-3 pr-4 py-2 shadow-lg hover:scale-105 transition"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Позвонить</span>
            </a>
          </div>
        )}
        {!chatOpen && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Закрыть контакты" : "Открыть контакты"}
            aria-expanded={open}
            className="h-14 w-14 rounded-full bg-gradient-primary glow-primary-lg text-primary-foreground shadow-xl flex items-center justify-center transition hover:scale-105 active:scale-95"
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
          </button>
        )}
      </div>
    </>
  );
}
