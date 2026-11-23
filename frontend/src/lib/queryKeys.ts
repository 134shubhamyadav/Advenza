export const queryKeys = {
  trips: () => ["trips"] as const,
  tripDetails: (id: string) => ["trips", id] as const,
  packingList: (dest: string, start?: string, end?: string, style?: string) =>
    ["packing", dest, start || "", end || "", style || ""] as const,
  riskRadar: (dest: string, tripId?: string, updatedAt?: string) =>
    ["risk", dest, tripId || "", updatedAt || ""] as const,
};
