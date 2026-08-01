export const ATTACHMENT_ACCEPTED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];
export const ATTACHMENT_MAX_SIZE_BYTES = 300 * 1024;

export function validateAttachment(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ATTACHMENT_ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type. Accepted: ${ATTACHMENT_ACCEPTED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return "File is too large (max 300KB).";
  }
  return null;
}

export async function ingestAttachment(file: File): Promise<string> {
  const content = await file.text();
  await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, content, source: "chat-attachment" }),
  });
  return content;
}

export function withAttachment(text: string, fileName: string, content: string): string {
  return `${text}\n\n[Attached file: ${fileName}]\n${content}`;
}
