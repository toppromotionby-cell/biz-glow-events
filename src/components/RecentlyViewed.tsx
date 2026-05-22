import { Link } from "@tanstack/react-router";
import { useRecent } from "@/lib/recent";
import type { CartEntityType } from "@/lib/cart";

const BASE: Record<CartEntityType, string> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
};

export function RecentlyViewed({ excludeId, max = 6 }: { excludeId?: string; max?: number }) {
  const all = useRecent();
  const items = all.filter(i => i.id !== excludeId).slice(0, max);
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-xl font-display font-semibold mb-4">Недавно просмотренные</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {items.map(i => (
          <li key={`${i.entity_type}:${i.id}`} className="snap-start shrink-0 w-48 glass rounded-lg overflow-hidden hover:glow-primary transition">
            <Link to={`${BASE[i.entity_type]}/${i.slug}`} className="block">
              <div className="aspect-[16/10] bg-surface">
                {i.image && <img src={i.image} alt={i.title} loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="p-3 text-sm font-medium line-clamp-2">{i.title}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
