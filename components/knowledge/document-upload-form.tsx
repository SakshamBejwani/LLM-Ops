"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ATTACHMENT_ACCEPTED_EXTENSIONS, validateAttachment } from "@/lib/attachments/client";

export function DocumentUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    const validationError = validateAttachment(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const content = await file.text();
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, content, source: "upload" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleChange}
        className="hidden"
      />
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? "Uploading…" : "Upload document"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
