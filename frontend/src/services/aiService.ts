import { apiFetch } from "../lib/api";

export const aiService = {
  /**
   * Generate an AI trip itinerary
   */
  async generateTrip(payload: any): Promise<any> {
    return apiFetch("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * What-If Simulator / Plan B disruption evaluation
   */
  async evaluatePlanB(tripId: string, text: string, simulatedDay: number, chatMessages: any[]): Promise<{ reply: string; proposedDays?: any[] }> {
    return apiFetch("/api/ai/plan-b", {
      method: "POST",
      body: JSON.stringify({ tripId, text, simulatedDay, chatMessages }),
    });
  },

  /**
   * AI Risk Radar & Weather analysis
   */
  async getRiskAnalysis(destination: string, refresh?: boolean): Promise<any> {
    return apiFetch("/api/ai/risk", {
      method: "POST",
      body: JSON.stringify({ destination, refresh }),
    });
  },

  /**
   * AI Travel Assistant Chat with RAG
   */
  async chat(messages: { role: string; content?: string; text?: string }[]): Promise<{ reply: string }> {
    return apiFetch("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  },

  /**
   * Smart AI Packing List generation
   */
  async getPackingList(payload: { destination: string; startDate?: string; endDate?: string; style?: string }): Promise<any> {
    return apiFetch("/api/ai/packing", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
