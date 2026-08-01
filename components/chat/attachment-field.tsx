"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ATTACHMENT_ACCEPTED_EXTENSIONS, validateAttachment } from "@/lib/attachments/client";

export function AttachmentPickerButton({
  disabled,
  onSelect,
  onError,
}: {
  disabled?: boolean;
  onSelect: (file: File) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;

    const validationError = validateAttachment(selected);
    if (validationError) {
      onError(validationError);
      return;
    }
    onSelect(selected);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach file"
      >
        📎
      </Button>
    </>
  );
}

export function AttachmentChip({ file, onClear }: { file: File; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
      📎 {file.name}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 text-muted-foreground hover:text-foreground"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </span>
  );
}
