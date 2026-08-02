"use client";

import { useRouter } from "next/navigation";
import { ConnectorForm, type ConnectorFormValues } from "@/components/connectors/connector-form";

export default function NewConnectorPage() {
  const router = useRouter();

  const handleSubmit = async (values: ConnectorFormValues) => {
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ? JSON.stringify(data.error) : "Failed to create connector");
    }
    const data = await res.json();
    router.push(`/connectors/${data.connector.id}`);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New connector</h1>
        <p className="text-sm text-muted-foreground">
          Pick a type, fill in its config, then attach it to a bot from the bot&apos;s Tools list.
        </p>
      </div>
      <ConnectorForm submitLabel="Create connector" onSubmit={handleSubmit} />
    </div>
  );
}
