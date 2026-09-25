import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { inr } from "@/lib/utils";

interface SettlementViewProps {
  tripId: string;
  tripCurrency?: string;
}

export function SettlementView({ tripId, tripCurrency = "INR" }: SettlementViewProps) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["budgetSettlement", tripId],
    queryFn: async () => {
      const res = await apiFetch(`/api/trips/${tripId}/budget/settlement`);
      return res;
    },
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const balances = data?.balances || [];
  const settlements = data?.settlements || [];
  const totalGroupSpend = data?.totalGroupSpend || 0;

  return (
    <div className="space-y-6">
      {/* Header and Total */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl glass-panel p-6 border border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Group Debt Settlement</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Mathematically simplified minimum cash transactions. Resolves all shared expenses with zero debt cycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Group Spend</p>
            <p className="font-display text-xl font-bold text-foreground">
              {tripCurrency} {totalGroupSpend.toLocaleString("en-IN")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Member Balances */}
        <div className="rounded-2xl glass-panel p-6">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Individual Balances
          </h4>

          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No shared expenses recorded for this trip yet.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {balances.map((b: any) => {
                const isCreditor = b.netBalance > 0.01;
                const isDebtor = b.netBalance < -0.01;

                return (
                  <div key={b.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid: {tripCurrency} {b.totalPaid.toLocaleString("en-IN")} · Share: {tripCurrency}{" "}
                        {b.totalOwed.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="text-right">
                      {isCreditor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Gets back {tripCurrency} {b.netBalance.toLocaleString("en-IN")}
                        </span>
                      )}
                      {isDebtor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          Owes {tripCurrency} {Math.abs(b.netBalance).toLocaleString("en-IN")}
                        </span>
                      )}
                      {!isCreditor && !isDebtor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          ✓ Settled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simplified Settlement Paths */}
        <div className="rounded-2xl glass-panel p-6 border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-primary mb-4 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Recommended Transfers
          </h4>

          {settlements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/70 mb-2" />
              <p className="font-medium text-foreground">All accounts settled!</p>
              <p className="text-xs mt-1">No outstanding balances or payments required.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settlements.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-border bg-background/80 p-3.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{s.from}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm text-foreground">{s.to}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-base font-bold text-primary">
                      {tripCurrency} {s.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
