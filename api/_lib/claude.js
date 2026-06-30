import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";

const MODEL = "claude-haiku-4-5";
const MAX_DESCRIPTION_WORDS = 200;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function trimWords(text, max) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= max ? text : words.slice(0, max).join(" ");
}

// Anthropic batch custom_id must be unique per request and <=64 chars — a
// short hash of the story URL lets us recompute the id later to match
// results back to stories without storing an explicit id->url mapping.
export function storyHash(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

const MAX_SUMMARY_WORDS = 60;

function buildSummaryPrompt(title, description) {
  const trimmed = trimWords(description.replace(/…$/, ""), MAX_DESCRIPTION_WORDS);
  const storyText = [title, trimmed].filter(Boolean).join(". ");
  return `Summarise this news story in 55-60 words — get as close to 60 as you can without ever going over it. Pack in specific detail (names, numbers, places) to reach that length rather than stopping early. Write in plain English. End with a complete sentence and a normal full stop — never use an ellipsis or trail off mid-thought. Respond with the summary text only — no title, no heading, no markdown formatting, no bullet points. Story: ${storyText}`;
}

// Safety net for the rare response that ignores the "no markdown" instruction
// — strips a leading "# Heading" line (and the blank line after it) so a
// stray title never ends up stored as part of the brief.
function stripLeadingHeading(text) {
  return text.replace(/^#{1,6}\s+.+\n+/, "").trim();
}

// Hard enforcement of the 60-word cap — the prompt alone isn't 100% reliable,
// so trim to the longest run of complete sentences that fits within the
// limit (falls back to a plain word-truncate only if a single sentence is
// itself over the limit, which is rare for a 60-word target).
function enforceMaxWords(text, max) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;

  const sentences = text.match(/[^.!?]*[.!?]+(?:\s+|$)/g) ?? [text];
  let kept = "";
  let count = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    if (count + sentenceWords > max) break;
    kept += sentence;
    count += sentenceWords;
  }
  return kept.trim() || words.slice(0, max).join(" ") + ".";
}

// Submits one Batch API job covering every story (each { url, title, description }).
// Returns the Anthropic batch id.
export async function submitSummaryBatch(stories) {
  const client = getClient();
  const requests = stories.map((s) => ({
    custom_id: storyHash(s.url),
    params: {
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: buildSummaryPrompt(s.title, s.description) }],
    },
  }));
  const batch = await client.messages.batches.create({ requests });
  return batch.id;
}

// Returns { done: false } while still processing, or
// { done: true, briefs: Map<hash, string|null> } once every request has ended.
export async function pollSummaryBatch(batchId) {
  const client = getClient();
  const batch = await client.messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") return { done: false };

  const briefs = new Map();
  const stream = await client.messages.batches.results(batchId);
  for await (const line of stream) {
    const raw = line.result.type === "succeeded"
      ? line.result.message.content.find((b) => b.type === "text")?.text?.trim()
      : null;
    briefs.set(line.custom_id, raw ? enforceMaxWords(stripLeadingHeading(raw), MAX_SUMMARY_WORDS) : null);
  }
  return { done: true, briefs };
}

// Single-shot completion — used for the weekly Brit Bit edition, which is
// one Claude call rather than a per-story batch.
export async function complete(prompt, maxTokens = 800) {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content.find((b) => b.type === "text")?.text?.trim();
}
