"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConnectorForm, type ConnectorFormValues } from "@/components/connectors/connector-form";
import type { Connector } from "@/lib/connectors/types";

export function ConnectorEditPanel({ connector }: { connector: Connector }) {
  const router = useRouter();

  const handleSubmit = async (values: ConnectorFormValues) => {
    const res = await fetch(`/api/connectors/${connector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ? JSON.stringify(data.error) : "Failed to save connector");
    }
    toast.success("Connector saved");
    router.refresh();
  };

  return (
    <ConnectorForm
      initialValues={{ ...connector, description: connector.description ?? "" }}
      connectorId={connector.id}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
    />
  );
}
