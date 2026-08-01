"use client";

import { useRouter } from "next/navigation";
import { BotForm, type BotFormValues } from "@/components/bots/bot-form";

export default function NewBotPage() {
  const router = useRouter();

  const handleSubmit = async (values: BotFormValues) => {
    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ? JSON.stringify(data.error) : "Failed to create bot");
    }
    const data = await res.json();
    router.push(`/bots/${data.bot.id}`);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New bot</h1>
        <p className="text-sm text-muted-foreground">
          Give it a name, a system prompt, pick a model and attach tools.
        </p>
      </div>
      <BotForm submitLabel="Create bot" onSubmit={handleSubmit} />
    </div>
  );
}
