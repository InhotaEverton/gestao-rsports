import { Card } from "@/components/ui/card";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/** Skeleton de tabela/lista — evita layout shift ao carregar. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <div className="hidden md:block">
        <div className="flex gap-4 px-4 py-3 bg-muted/50">
          {Array.from({ length: cols }).map((_, i) => (
            <Bar key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-4 border-t border-border">
            {Array.from({ length: cols }).map((_, i) => (
              <Bar key={i} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
      <div className="md:hidden divide-y divide-border">
        {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
          <div key={r} className="p-4 space-y-2">
            <Bar className="h-4 w-1/2" />
            <Bar className="h-3 w-1/3" />
            <Bar className="h-8 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton de cards de estatística. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 space-y-3">
          <Bar className="h-8 w-8 rounded-lg" />
          <Bar className="h-3 w-2/3" />
          <Bar className="h-6 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

/** Skeleton genérico de bloco/gráfico. */
export function BlockSkeleton({ className = "h-64" }: { className?: string }) {
  return <Bar className={`w-full ${className}`} />;
}
