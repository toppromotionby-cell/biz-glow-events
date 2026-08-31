// Общий компонент страницы списка каталога.
// Используется фабрикой `makeCatalogListRoute` для 4 типов каталога.
import { CatalogGrid } from "@/components/CatalogGrid";
import type { CatalogPageConfig } from "@/lib/catalog-page-config";
import type { CatalogItem } from "@/lib/catalog-mock";

interface CatalogListPageProps {
  config: CatalogPageConfig;
  items: CatalogItem[];
  categories?: { id: string; name: string }[];
}

export function CatalogListPage({ config, items, categories }: CatalogListPageProps) {
  return (
    <div className="page-shell section-y">
      <header className="max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold gradient-text">{config.h1}</h1>
        <p className="mt-4 text-muted-foreground">{config.lead}</p>
      </header>
      <CatalogGrid
        items={items}
        category={config.category}
        basePath={config.basePath}
        entityType={config.type}
        categories={categories}
      />
    </div>
  );
}
