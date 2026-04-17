import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/portal/kb"],
    queryFn: () => authFetch("/api/portal/kb"),
  });

  const toggle = (id: number) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const filtered = search
    ? items.filter((a: any) => a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase()))
    : items;

  // Group by type
  const groups: Record<string, any[]> = {};
  for (const item of filtered) {
    const g = item.type === "service_guide" ? "Service Guide" : item.type === "kb" ? "Knowledge Base" : "Announcements";
    (groups[g] ||= []).push(item);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#394442] dark:text-white">Knowledge Base</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}

      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No articles found.</CardContent></Card>
      )}

      {Object.entries(groups).map(([groupName, articles]) => (
        <div key={groupName}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{groupName}</h2>
          <div className="space-y-2">
            {articles.map((a: any) => (
              <Card key={a.id}>
                <button className="w-full text-left" onClick={() => toggle(a.id)}>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                      {expanded.has(a.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <CardTitle className="text-sm">{a.title}</CardTitle>
                    </div>
                  </CardHeader>
                </button>
                {expanded.has(a.id) && (
                  <CardContent className="pt-0 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-sm text-[#394442] dark:text-gray-200 whitespace-pre-wrap ml-6 py-2">{a.body}</div>
                    {a.publishedAt && (
                      <div className="text-[10px] text-muted-foreground ml-6 mt-2">
                        Published {new Date(a.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
