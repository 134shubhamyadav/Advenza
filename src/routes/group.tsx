import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserPlus, Check, X, AlertCircle } from "lucide-react";
import { groupMembers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/group")({ component: Group });

function Group() {
  return (
    <AppShell title="Group planning" subtitle="Udaipur · 4 travelers">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl glass-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Members</h3>
            <span className="text-xs text-muted-foreground">3 confirmed · 1 pending</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {groupMembers.map((m) => (
              <div key={m.name} className="flex items-center gap-3 rounded-xl glass-tile p-4">
                <Avatar className="h-10 w-10"><AvatarFallback className={m.color}>{m.initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                {m.role === "Pending" && <Button variant="ghost" size="sm">Remind</Button>}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input placeholder="friend@email.com" className="h-11 rounded-xl" />
            <Button className="h-11"><UserPlus className="mr-1.5 h-4 w-4" />Invite</Button>
          </div>
        </div>

        <div className="rounded-2xl glass-panel p-6">
          <h3 className="font-semibold">Group preferences</h3>
          <div className="mt-4 space-y-3">
            {[
              { l: "Food", tags: ["Local", "Seafood", "Vegetarian"] },
              { l: "Pace", tags: ["Slow", "Balanced"] },
              { l: "Vibe", tags: ["Nature", "Sunsets", "History"] },
            ].map((r) => (
              <div key={r.l}>
                <p className="text-xs text-muted-foreground">{r.l}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.tags.map((t) => <Badge key={t} variant="secondary" className="rounded-full">{t}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Vote: pick our sunset spot</h3>
            <Badge className="bg-warning/15 text-warning-foreground border border-warning/30"><AlertCircle className="mr-1 h-3 w-3" />Conflict on Jun 14</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "Ambrai Ghat", pct: 75, votes: 3, chosen: true },
              { n: "Sajjangarh Palace", pct: 50, votes: 2 },
              { n: "Karni Mata ropeway", pct: 25, votes: 1 },
            ].map((o) => (

              <div key={o.n} className={cn("rounded-xl border p-5 transition", o.chosen ? "border-accent bg-accent/5" : "glass-tile")}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{o.n}</p>
                  {o.chosen && <Check className="h-4 w-4 text-accent" />}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${o.pct}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{o.votes} votes</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
          <h3 className="font-semibold">Shared expenses</h3>
          <div className="mt-4 divide-y divide-border/60 text-sm">
            {[
              { n: "Lake Palace deposit", by: "You", a: 52000, split: "4 ways" },
              { n: "Auto-rickshaw day pass", by: "Arjun", a: 4000, split: "4 ways" },
              { n: "Group dinner at 1559 AD", by: "Maya", a: 15000, split: "4 ways" },
            ].map((e) => (

              <div key={e.n} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{e.n}</p>
                  <p className="text-xs text-muted-foreground">Paid by {e.by} · {e.split}</p>
                </div>
                <p className="font-semibold">₹{e.a.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
