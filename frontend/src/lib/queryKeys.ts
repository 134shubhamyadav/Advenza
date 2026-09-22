export const queryKeys = {
  trips: () => ["trips"] as const,
  tripDetails: (id: string) => ["trips", id] as const,
  packingList: (dest: string, start?: string, end?: string, style?: string) =>
    ["packing", dest, start || "", end || "", style || ""] as const,
  riskRadar: (dest: string) => ["risk", dest] as const,
  commanderEvents: () => ["commander", "events"] as const,
};
