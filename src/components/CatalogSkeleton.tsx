// Skeleton для списка каталога — снижает CLS и улучшает воспринимаемую скорость.
export function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-muted/40" />
          <div className="p-4 space-y-3">
            <div className="h-3 w-16 rounded bg-muted/60" />
            <div className="h-5 w-3/4 rounded bg-muted/60" />
            <div className="h-3 w-full rounded bg-muted/40" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-24 rounded bg-muted/60" />
              <div className="h-9 w-20 rounded bg-muted/60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
