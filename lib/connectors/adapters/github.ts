import { z } from "zod";
import { tool } from "ai";
import type { GithubConfig } from "../types";

// Deliberately a small, read-mostly slice of the GitHub REST API - not a
// generic passthrough - matching this app's "no speculative extensibility"
// house rule for connectors.
const GITHUB_API = "https://api.github.com";

export function buildTool(config: GithubConfig) {
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  return tool({
    description: "Read or file GitHub issues, and look up repo metadata, for a given owner/repo.",
    inputSchema: z.object({
      operation: z.enum(["get_repo", "list_issues", "create_issue"]),
      owner: z.string(),
      repo: z.string(),
      state: z.enum(["open", "closed", "all"]).optional().describe("Only used by list_issues."),
      title: z.string().optional().describe("Required by create_issue."),
      body: z.string().optional().describe("Only used by create_issue."),
    }),
    execute: async ({ operation, owner, repo, state, title, body }) => {
      if (operation === "get_repo") {
        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
        if (!res.ok) throw new Error(`GitHub get_repo failed: ${res.status} ${await res.text()}`);
        return await res.json();
      }

      if (operation === "list_issues") {
        const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
        url.searchParams.set("state", state ?? "open");
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`GitHub list_issues failed: ${res.status} ${await res.text()}`);
        return await res.json();
      }

      if (!title) throw new Error("create_issue requires a title");
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) throw new Error(`GitHub create_issue failed: ${res.status} ${await res.text()}`);
      return await res.json();
    },
  });
}
