// Stack AI: the only place that talks to the AI engine. A Supabase Edge
// Function (Deno): it keeps the API key (never sent to the app), checks the
// Supabase sign-in, applies a daily limit per person and streams the answer
// back as NDJSON lines:
//   {"t":"text","v":"…"}   a piece of the answer as it's written
//   {"t":"reset"}          a fallback model took over: throw away the text so far
//   {"t":"done","blocks":[{"text":"…","cites":[…]}],"engine":"Sarvam AI"}   the final answer
//   {"t":"error","code":"…","v":"…"}
// Engines: Sarvam AI (SARVAM_API_KEY), Google Gemini (GEMINI_API_KEY), Groq
// (GROQ_API_KEY), OpenAI (OPENAI_API_KEY) and Claude (ANTHROPIC_API_KEY), the
// function's secrets (supabase/README.md). Each feature tries its engines in
// order and moves to the next when one fails (out of credit, busy, down), so
// free tiers can be stacked. Only engines with a key are used.
// The Android app has no server of its own; it calls this function.
import Anthropic from "npm:@anthropic-ai/sdk@^0.129.0";
import OpenAI from "npm:openai@^7.23.0";
import { createClient } from "npm:@supabase/supabase-js@^2.117.2";

const env = (name: string) => Deno.env.get(name) ?? "";

type Task = "summary" | "tidy" | "ask" | "pdf" | "explain";
const TASKS: Task[] = ["summary", "tidy", "ask", "pdf", "explain"];
type Source = { id: string; title: string; text: string };
type Turn = { q: string; a: string };
type Body = {
  task: Task;
  title?: string;
  text?: string; // summary: the article · tidy: the note · explain: the selected line
  context?: string; // explain: the paragraph around the line
  lang?: string; // answer language, e.g. "hi" (tidy always keeps the note's own language)
  question?: string;
  sources?: Source[]; // ask: the notes and highlights to answer from
  pdf?: string; // pdf: base64
  history?: Turn[]; // pdf: earlier questions in this chat
};
type Cite = { page?: number; source?: string; title?: string; cited: string };
type Block = { text: string; cites: Cite[] };

type Engine = "sarvam" | "gemini" | "groq" | "openai" | "anthropic";
const ENGINES: Record<Engine, { key: string; name: string; pdf: boolean }> = {
  sarvam: { key: "SARVAM_API_KEY", name: "Sarvam AI", pdf: false },
  gemini: { key: "GEMINI_API_KEY", name: "Google Gemini", pdf: true },
  groq: { key: "GROQ_API_KEY", name: "Groq", pdf: false },
  openai: { key: "OPENAI_API_KEY", name: "OpenAI", pdf: true },
  anthropic: { key: "ANTHROPIC_API_KEY", name: "Claude", pdf: true },
};
// Sarvam first for text (cheap, Indian languages); PDF chat needs an engine that reads PDF files.
const DEFAULT_ORDER: Engine[] = ["sarvam", "gemini", "groq", "openai", "anthropic"];
const PDF_ORDER: Engine[] = ["gemini", "anthropic", "openai"];

// The engines to try for a task, in order: AI_ENGINES_<TASK> or AI_ENGINES
// ("sarvam,gemini"), else the defaults (with the older AI_PROVIDER first).
function enginesFor(task: Task): Engine[] {
  const set = env(`AI_ENGINES_${task.toUpperCase()}`) || env("AI_ENGINES");
  const legacy = env("AI_PROVIDER").toLowerCase() as Engine;
  const base = task === "pdf" ? PDF_ORDER : DEFAULT_ORDER;
  const order = set
    ? (set.toLowerCase().split(/[\s,]+/) as Engine[])
    : ENGINES[legacy]
      ? [legacy, ...base.filter((e) => e !== legacy)]
      : base;
  return [...new Set(order)].filter((e) => ENGINES[e] && env(ENGINES[e].key) && (task !== "pdf" || ENGINES[e].pdf));
}

// One model setting per engine and task, so a model can be switched without an app update.
const model = (prefix: string, task: Task, fallback: string) =>
  env(`${prefix}_${task.toUpperCase()}`) || env(prefix) || fallback;
const CLAUDE_MODEL = (task: Task) => model("AI_MODEL", task, "claude-sonnet-5-5");
const OPENAI_MODEL = (task: Task) => model("OPENAI_MODEL", task, "gpt-5.4-mini");
const SARVAM_MODEL = (task: Task) => model("SARVAM_MODEL", task, "sarvam-105b");
const GEMINI_MODEL = (task: Task) => model("GEMINI_MODEL", task, "gemini-3.1-flash-lite");
const GROQ_MODEL = (task: Task) => model("GROQ_MODEL", task, "openai/gpt-oss-120b");

const LANGS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  od: "Odia",
  pa: "Punjabi",
  ta: "Tamil",
  te: "Telugu",
};
const LIMIT = Number(env("AI_DAILY_LIMIT") || 50);
const MAX_PDF_B64 = 30_000_000; // Claude takes up to 32 MB per request

// Page references the model writes: "(p. 4)", "(pp. 7–8)", "(p. 3, p. 4)",
// "(p. 87, 274)", "(page 12)", "(pages 3 and 5)". Each becomes a page link
// (the first page of a range) and the marker is taken out of the text.
function pageRefs(text: string, onPage: (page: number) => void) {
  return text.replace(/\s?\((\s*(?:pp?\.|pages?)\s*\d[^()]*)\)/gi, (whole, inside: string) => {
    // Only if the brackets hold nothing but page numbers.
    if (!/^[\s\d,;–—&-]*$/.test(inside.replace(/pp?\.|pages?|and/gi, ""))) return whole;
    for (const m of inside.matchAll(/(\d{1,4})(?:\s*[–—-]\s*\d{1,4})?/g)) onPage(Number(m[1]));
    return "";
  });
}

const PROMPTS: Record<Task, string> = {
  summary:
    "You summarise news and blog articles for a reading app. Reply with exactly three short bullet points (lines starting with \"- \") covering what matters most, then one line starting with \"Takeaway: \" saying why it matters to the reader. Plain text, no headings, no bold. Use the article's language.",
  tidy:
    "You tidy up quick notes in a notes app. Keep the writer's meaning, words and language; fix spelling, remove repetition, and give it structure. Reply in plain text: first line is a short title (no \"Title:\" label), then a blank line, then the note. Use \"- \" bullets for lists of ideas and \"[ ] \" lines for things to do. Never add facts that aren't in the note.",
  ask: "You answer questions using only the reader's own saved notes and highlights, provided as search results. Cite the notes you use. If the notes don't answer the question, say so briefly and suggest what they do cover. Keep answers short: a few sentences or a short list. Plain text, no headings.",
  pdf: "You help someone understand the PDF they are reading. Answer from the document and cite the pages you use. If the document doesn't cover the question, say so. Keep answers short and clear: a few sentences or a short list. Plain text, no headings.",
  explain:
    "You explain a hard line from something the reader is reading, as a patient teacher would to a curious student. Say what it means in simple everyday words in two to four short sentences, explain any difficult word or idea in it, and use the surrounding text only for context. Plain text, no headings, no bold.",
};
// Engines without built-in citations write markers that are turned into links.
const OPENAI_CITE: Partial<Record<Task, string>> = {
  ask: " Each search result is numbered like [1]; after a sentence that uses one, write its number in square brackets, e.g. [2].",
  pdf: " After a sentence that uses the document, write the page in the form (p. 12).",
};

// ---- One description of each request, handed to either engine ----
type Part = { text: string } | { pdf: string; title: string } | { source: Source };
type Job = {
  task: Task;
  system: string;
  effort: "low" | "medium";
  maxTokens: number;
  turns: { role: "user" | "assistant"; parts: Part[] }[];
};

const clip = (s: string | undefined, max: number) => (s ?? "").slice(0, max);

function buildJob(b: Body): Job | string {
  const q = clip(b.question, 2000).trim();
  const lang = b.task !== "tidy" && b.lang && b.lang !== "en" ? LANGS[b.lang] : undefined;
  const job = (effort: Job["effort"], maxTokens: number, turns: Job["turns"]): Job => ({
    task: b.task,
    system: PROMPTS[b.task] + (lang ? ` Write your whole answer in ${lang}, in simple everyday ${lang}, even if the source is in another language.` : ""),
    effort,
    maxTokens,
    turns,
  });
  switch (b.task) {
    case "summary": {
      const text = clip(b.text, 120_000).trim();
      if (!text) return "Nothing to summarise.";
      return job("low", 2000, [{ role: "user", parts: [{ text: `Title: ${clip(b.title, 300)}\n\n${text}` }] }]);
    }
    case "tidy": {
      const text = clip(b.text, 20_000).trim();
      if (!text) return "The note is empty.";
      return job("low", 4000, [{ role: "user", parts: [{ text }] }]);
    }
    case "ask": {
      const sources = (b.sources ?? []).slice(0, 30);
      if (!q) return "Ask a question.";
      if (!sources.length) return "There are no notes to answer from yet.";
      const parts: Part[] = sources.map((s) => ({
        source: { id: clip(s.id, 200), title: clip(s.title, 200) || "Note", text: clip(s.text, 4000) || "(empty)" },
      }));
      return job("medium", 4000, [{ role: "user", parts: [...parts, { text: q }] }]);
    }
    case "pdf": {
      if (!q) return "Ask a question.";
      if (!b.pdf || b.pdf.length > MAX_PDF_B64) return "This PDF is too big to send (the limit is about 22 MB).";
      const history = (b.history ?? []).slice(-6);
      // The PDF goes first (and is cached by Claude), then the conversation.
      const turns: Job["turns"] = [
        { role: "user", parts: [{ pdf: b.pdf, title: clip(b.title, 200) || "PDF" }, { text: clip(history[0]?.q ?? q, 2000) }] },
      ];
      history.forEach((t, i) => {
        turns.push({ role: "assistant", parts: [{ text: clip(t.a, 8000) || "…" }] });
        turns.push({ role: "user", parts: [{ text: clip(i + 1 < history.length ? history[i + 1].q : q, 2000) }] });
      });
      return job("medium", 6000, turns);
    }
    case "explain": {
      const text = clip(b.text, 2000).trim();
      if (!text) return "Select some text to explain.";
      const ctx = clip(b.context, 4000).trim();
      const head = b.title ? `From: ${clip(b.title, 300)}\n\n` : "";
      return job("low", 1500, [
        { role: "user", parts: [{ text: `${head}${ctx ? `Surrounding text:\n${ctx}\n\n` : ""}Explain this line:\n${text}` }] },
      ]);
    }
  }
}

type Emit = (o: object) => void;

// ---- Claude ----
let claude: Anthropic | null = null;

async function runClaude(job: Job, emit: Emit) {
  const messages: Anthropic.Beta.BetaMessageParam[] = job.turns.map((t) => ({
    role: t.role,
    content: t.parts.map((p): Anthropic.Beta.BetaContentBlockParam =>
      "pdf" in p
        ? {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: p.pdf },
            title: p.title,
            citations: { enabled: true },
            cache_control: { type: "ephemeral" },
          }
        : "source" in p
          ? {
              type: "search_result",
              source: p.source.id,
              title: p.source.title,
              content: [{ type: "text", text: p.source.text }],
              citations: { enabled: true },
            }
          : { type: "text", text: p.text },
    ),
  }));
  // Anthropic's default fallback: a declined request is retried on the model
  // recommended for that kind of decline, inside the same call.
  const s = (claude ??= new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") })).beta.messages.stream({
    model: CLAUDE_MODEL(job.task),
    max_tokens: job.maxTokens,
    output_config: { effort: job.effort },
    system: job.system,
    messages,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  for await (const e of s) {
    if (e.type === "content_block_start" && e.content_block.type === "fallback") emit({ t: "reset" });
    if (e.type === "content_block_delta" && e.delta.type === "text_delta") emit({ t: "text", v: e.delta.text });
  }
  const msg = await s.finalMessage();
  if (msg.stop_reason === "refusal") return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });
  const blocks: Block[] = msg.content.flatMap((c) =>
    c.type === "text"
      ? [
          {
            text: c.text,
            cites: (c.citations ?? []).flatMap((x): Cite[] =>
              x.type === "page_location"
                ? [{ page: x.start_page_number, cited: x.cited_text }]
                : x.type === "search_result_location"
                  ? [{ source: x.source, title: x.title ?? undefined, cited: x.cited_text }]
                  : [],
            ),
          },
        ]
      : [],
  );
  emit({ t: "done", blocks, cut: msg.stop_reason === "max_tokens" });
}

// ---- OpenAI ----
let openai: OpenAI | null = null;

async function runOpenAI(job: Job, emit: Emit) {
  const sources: Source[] = [];
  const input = job.turns.map((t) =>
    t.role === "assistant"
      ? { role: "assistant" as const, content: t.parts.map((p) => ("text" in p ? p.text : "")).join("\n") }
      : {
          role: "user" as const,
          content: t.parts.map((p): OpenAI.Responses.ResponseInputContent => {
            if ("pdf" in p)
              return { type: "input_file", filename: `${p.title.replace(/[^\w .-]/g, "") || "document"}.pdf`, file_data: `data:application/pdf;base64,${p.pdf}` };
            if ("source" in p) {
              sources.push(p.source);
              return { type: "input_text", text: `[${sources.length}] ${p.source.title}\n${p.source.text}` };
            }
            return { type: "input_text", text: p.text };
          }),
        },
  );
  const s = (openai ??= new OpenAI({ apiKey: env("OPENAI_API_KEY") })).responses.stream({
    model: OPENAI_MODEL(job.task),
    instructions: job.system + (OPENAI_CITE[job.task] ?? ""),
    input,
    max_output_tokens: job.maxTokens * 2, // reasoning tokens count toward this too
    reasoning: { effort: job.effort },
  });
  for await (const e of s) {
    if (e.type === "response.output_text.delta") emit({ t: "text", v: e.delta });
  }
  const res = await s.finalResponse();
  const raw = res.output_text ?? "";
  if (!raw.trim()) return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });

  emit({ t: "done", blocks: [markersToCites(job.task, raw, sources)], cut: res.incomplete_details?.reason === "max_output_tokens" });
}

// Turn the written markers ([2] for notes, (p. 4) for pages) into the same citations Claude gives.
function markersToCites(task: Task, raw: string, sources: Source[]): Block {
  const cites: Cite[] = [];
  let text = raw;
  if (task === "ask")
    text = raw.replace(/\s?\[(\d{1,2})\](?!\()/g, (_, n) => {
      const src = sources[Number(n) - 1];
      if (src) cites.push({ source: src.id, title: src.title, cited: "" });
      return "";
    });
  if (task === "pdf")
    text = pageRefs(raw, (page) => {
      if (!cites.some((c) => c.page === page)) cites.push({ page, cited: "" });
    });
  return { text, cites };
}

// ---- Engines spoken to over plain HTTP: Sarvam, Groq, Gemini ----
class EngineError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    let said = raw;
    try {
      const j = JSON.parse(raw);
      said = j?.error?.message ?? j?.message ?? (Array.isArray(j) ? j[0]?.error?.message : undefined) ?? raw;
    } catch {}
    throw new EngineError(res.status, String(said).slice(0, 300));
  }
  return res.body;
}

// The JSON of each "data:" line of a server-sent event stream.
async function* sse(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      const d = l.startsWith("data:") ? l.slice(5).trim() : "";
      if (!d || d === "[DONE]") continue;
      try {
        yield JSON.parse(d);
      } catch {}
    }
  }
}

// Hides "<think>…</think>" reasoning some models write into the answer, even split across pieces.
function thinkFilter(emit: Emit) {
  let inside = false;
  let carry = "";
  let all = "";
  return {
    push(piece: string) {
      let s = carry + piece;
      carry = "";
      let out = "";
      while (s) {
        const tag = inside ? "</think>" : "<think>";
        const at = s.indexOf(tag);
        if (at >= 0) {
          if (!inside) out += s.slice(0, at);
          s = s.slice(at + tag.length);
          inside = !inside;
          continue;
        }
        // Keep a possible half tag at the end for the next piece.
        const keep = [...Array(tag.length - 1).keys()].map((i) => i + 1).reverse().find((n) => tag.startsWith(s.slice(-n))) ?? 0;
        if (!inside) out += s.slice(0, s.length - keep);
        carry = s.slice(s.length - keep);
        s = "";
      }
      if (!all) out = out.replace(/^\s+/, "");
      if (out) {
        all += out;
        emit({ t: "text", v: out });
      }
    },
    text: () => all.trim(),
  };
}

// Sarvam and Groq both speak the OpenAI chat-completions format.
async function runChat(engine: "sarvam" | "groq", job: Job, emit: Emit) {
  const key = env(ENGINES[engine].key);
  const sources: Source[] = [];
  const messages = [
    { role: "system", content: job.system + (OPENAI_CITE[job.task] ?? "") },
    ...job.turns.map((t) => ({
      role: t.role,
      content: t.parts
        .map((p) => {
          if ("source" in p) {
            sources.push(p.source);
            return `[${sources.length}] ${p.source.title}\n${p.source.text}`;
          }
          return "text" in p ? p.text : "";
        })
        .join("\n\n"),
    })),
  ];
  const body =
    engine === "sarvam"
      ? await post(
          "https://api.sarvam.ai/v1/chat/completions",
          { authorization: `Bearer ${key}`, "api-subscription-key": key },
          // reasoning_effort null turns thinking off: even "low" thinks for
          // thousands of tokens, which costs credit and can leave no room for the answer.
          { model: SARVAM_MODEL(job.task), messages, stream: true, max_tokens: job.maxTokens, temperature: 0.2, reasoning_effort: null },
        )
      : await post(
          "https://api.groq.com/openai/v1/chat/completions",
          { authorization: `Bearer ${key}` },
          { model: GROQ_MODEL(job.task), messages, stream: true, max_completion_tokens: job.maxTokens * 2, temperature: 0.2, reasoning_effort: "low" },
        );
  const out = thinkFilter(emit);
  let finish = "";
  for await (const e of sse(body)) {
    if (e?.error) throw new EngineError(500, e.error.message ?? "stream error");
    const c = e?.choices?.[0];
    if (c?.delta?.content) out.push(c.delta.content);
    if (c?.finish_reason) finish = c.finish_reason;
  }
  const raw = out.text();
  if (!raw) {
    if (finish === "length") throw new EngineError(500, "ran out of room while thinking");
    return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });
  }
  emit({ t: "done", blocks: [markersToCites(job.task, raw, sources)], cut: finish === "length" });
}

// Google Gemini, through its own API (it reads PDF files too).
async function runGemini(job: Job, emit: Emit) {
  const m = GEMINI_MODEL(job.task);
  const sources: Source[] = [];
  const contents = job.turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: t.parts.map((p) => {
      if ("pdf" in p) return { inline_data: { mime_type: "application/pdf", data: p.pdf } };
      if ("source" in p) {
        sources.push(p.source);
        return { text: `[${sources.length}] ${p.source.title}\n${p.source.text}` };
      }
      return { text: p.text };
    }),
  }));
  const body = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,
    { "x-goog-api-key": env("GEMINI_API_KEY") },
    {
      systemInstruction: { parts: [{ text: job.system + (OPENAI_CITE[job.task] ?? "") }] },
      contents,
      generationConfig: {
        maxOutputTokens: job.maxTokens * 2,
        temperature: 0.2,
        ...(m.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    },
  );
  const out = thinkFilter(emit);
  let finish = "";
  let blocked = false;
  for await (const e of sse(body)) {
    if (e?.error) throw new EngineError(e.error.code ?? 500, e.error.message ?? "stream error");
    if (e?.promptFeedback?.blockReason) blocked = true;
    const c = e?.candidates?.[0];
    for (const p of c?.content?.parts ?? []) if (p.text && !p.thought) out.push(p.text);
    if (c?.finishReason) finish = c.finishReason;
  }
  const raw = out.text();
  if (!raw || blocked) {
    if (!blocked && finish === "MAX_TOKENS") throw new EngineError(500, "ran out of room while thinking");
    return emit({ t: "error", code: "refusal", v: "The AI couldn’t help with this one." });
  }
  emit({ t: "done", blocks: [markersToCites(job.task, raw, sources)], cut: finish === "MAX_TOKENS" });
}

function run(engine: Engine, job: Job, emit: Emit) {
  if (engine === "anthropic") return runClaude(job, emit);
  if (engine === "openai") return runOpenAI(job, emit);
  if (engine === "gemini") return runGemini(job, emit);
  return runChat(engine, job, emit);
}

// ---- Sign-in and the daily limit (Supabase) ----
// A client that acts as the person who sent the request. The function can be
// hosted in another Supabase project: then STACK_SUPABASE_URL (and optionally
// STACK_SUPABASE_KEY, the publishable key) point at Stack's own project, where
// the accounts and the daily counter live.
function asCaller(request: Request, token: string) {
  const elsewhere = env("STACK_SUPABASE_URL");
  const key = (elsewhere ? env("STACK_SUPABASE_KEY") : env("SUPABASE_ANON_KEY")) || request.headers.get("apikey") || "";
  return createClient(elsewhere || env("SUPABASE_URL"), key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// A short, readable reason for an API failure.
function explain(e: unknown) {
  const said =
    e instanceof Anthropic.APIError
      ? ((e.error as { error?: { message?: string } } | undefined)?.error?.message ?? e.message)
      : e instanceof OpenAI.APIError || e instanceof EngineError
        ? e.message
        : "";
  const status = e instanceof EngineError ? e.status : 0;
  if (status === 402 || /credit|quota|billing|insufficient|balance/i.test(said)) return "Stack AI is paused: the AI account is out of credit.";
  if (status === 429) return "Stack AI is busy. Try again in a minute.";
  if (status === 401 || status === 403) return "The server’s AI API key isn’t valid.";
  if (status === 400 || status === 422) return `The AI couldn’t read this request: ${said.slice(0, 140)}`;
  if (status) return `AI error ${status}. Try again.`;
  if (e instanceof Anthropic.RateLimitError || e instanceof OpenAI.RateLimitError) return "Stack AI is busy. Try again in a minute.";
  if (e instanceof Anthropic.AuthenticationError || e instanceof OpenAI.AuthenticationError) return "The server’s AI API key isn’t valid.";
  if (e instanceof Anthropic.BadRequestError || e instanceof OpenAI.BadRequestError) return `The AI couldn’t read this request: ${said.slice(0, 140)}`;
  if (e instanceof Anthropic.APIError || e instanceof OpenAI.APIError) return `AI error ${e.status ?? ""}. Try again.`;
  return "Couldn’t reach the AI. Try again.";
}

// The website (npm run dev) calls from a browser, which asks permission first.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const NDJSON = { ...CORS, "content-type": "application/x-ndjson", "cache-control": "no-store" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const line = (o: unknown) => new TextEncoder().encode(`${JSON.stringify(o)}\n`);
  const fail = (code: string, v: string, status: number) =>
    new Response(`${JSON.stringify({ t: "error", code, v })}\n`, { status, headers: NDJSON });
  if (request.method !== "POST") return fail("bad", "Bad request.", 405);

  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const db = asCaller(request, token);
  const { data: who } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!who.user) return fail("signin", "Sign in to use Stack AI.", 401);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return fail("bad", "Bad request.", 400);
  }
  if (!TASKS.includes(body?.task)) return fail("bad", "Unknown task.", 400);
  const job = buildJob(body);
  if (typeof job === "string") return fail("bad", job, 400);
  const engines = enginesFor(job.task);
  if (!engines.length)
    return fail("setup", job.task === "pdf" ? "PDF questions aren’t set up on the server yet." : "Stack AI isn’t set up on the server yet.", 503);
  // The count lives in the database (supabase/schema.sql: ai_take), so it
  // holds however many copies of this function are running.
  const { data: allowed, error } = await db.rpc("ai_take", { lim: LIMIT });
  if (error) return fail("setup", "Stack AI isn’t set up on the server yet.", 503);
  if (!allowed) return fail("limit", `You’ve used today’s ${LIMIT} Stack AI requests. They reset at midnight (UTC).`, 429);

  const stream = new ReadableStream({
    async start(controller) {
      // Try each engine in turn; if one fails partway, the app throws away its text.
      for (const [i, engine] of engines.entries()) {
        let wrote = false;
        const emit: Emit = (o) => {
          const m = o as { t: string };
          if (m.t === "text") wrote = true;
          controller.enqueue(line(m.t === "done" ? { ...m, engine: ENGINES[engine].name } : m));
        };
        try {
          await run(engine, job, emit);
          break;
        } catch (e) {
          console.error(`ai: ${engine} failed:`, e instanceof Error ? e.message : e);
          if (i < engines.length - 1) {
            if (wrote) controller.enqueue(line({ t: "reset" }));
            continue;
          }
          controller.enqueue(line({ t: "error", code: "api", v: explain(e) }));
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: NDJSON });
});
