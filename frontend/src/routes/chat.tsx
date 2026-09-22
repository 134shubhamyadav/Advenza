import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Plane, Map, Wallet, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/chat")({ component: Chat });

const prompts = [
  { icon: Plane, text: "7-day Rajasthan loop with great food" },
  { icon: Map, text: "Weekend near Bangalore in the hills" },
  { icon: Wallet, text: "Cut ₹15,000 from my Ladakh plan" },
  { icon: Utensils, text: "Best street food in Old Delhi" },
];

function Chat() {
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; text: string }[]>([
    {
      role: "assistant",
      text: "Namaste! I'm Advenza, your AI travel companion. I can search live news, train schedules, and travel alerts. Tell me where in India you'd like to go!",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg = { role: "user" as const, text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const data = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      setMessages((m) => [...m, { role: "assistant" as const, text: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant" as const,
          text: "Sorry, I'm having trouble connecting right now. Please make sure the backend server is running on port 5000.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">Advenza AI</p>
            <p className="text-xs text-muted-foreground">
              Powered by Groq Llama 3 · Live web search enabled
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Live
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "")}>
              {m.role === "assistant" && (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "glass-panel",
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="rounded-2xl glass-panel px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {prompts.map((p) => (
            <button
              key={p.text}
              onClick={() => send(p.text)}
              disabled={typing}
              className="flex items-center gap-2 rounded-xl glass-panel px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              <p.icon className="h-4 w-4 text-primary" />
              <span className="truncate">{p.text}</span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl glass-panel p-2 shadow-soft"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your trip — trains, news, weather, places…"
            disabled={typing}
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-xl"
            disabled={typing || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
