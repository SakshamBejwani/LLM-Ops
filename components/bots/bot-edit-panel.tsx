"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BotForm, type BotFormValues } from "@/components/bots/bot-form";
import type { Bot } from "@/lib/types";

export function BotEditPanel({ bot }: { bot: Bot }) {
  const router = useRouter();

  const handleSubmit = async (values: BotFormValues) => {
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ? JSON.stringify(data.error) : "Failed to save bot");
    }
    toast.success("Bot saved");
    router.refresh();
  };

  return (
    <BotForm
      initialValues={bot}
      excludeBotId={bot.id}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
    />
  );
}
