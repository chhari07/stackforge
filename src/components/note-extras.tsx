"use client";

// Extras in the note editor: tags, links to other notes and a reminder.
import Link from "next/link";
import { useMemo, useState } from "react";
import { patchNoteQuietly, type Note } from "@/lib/db";
import { isNative } from "@/lib/platform";
import { canRing, localValue, quickTimes, remindText, upcoming } from "@/lib/reminders";
import { CloseIcon, PlusIcon } from "./icons";
import { noteHref, noteLabel } from "./note-card";
import { Sheet } from "./sheet";
import { LinkIcon } from "./stack-icons";
import { useToast } from "./toast";
import { useT } from "@/lib/i18n";

/** A tag as it's stored: no #, no commas, single spaces, lower case. */
export const cleanTag = (t: string) => t.replace(/[#,]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 30);

/** Every tag in use, most used first. */
export function allTags(notes: Note[]) {
  const count = new Map<string, number>();
  for (const n of notes) for (const t of n.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

// The note's tags, each removable, and a box to add one (Enter or a comma adds it).
export function TagRow({ tags, known, onChange }: { tags: string[]; known: string[]; onChange: (tags: string[]) => void }) {
  const tt = useT();
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const t = cleanTag(raw);
    setText("");
    if (t && !tags.includes(t)) onChange([...tags, t]);
  };
  const offered = known.filter((t) => !tags.includes(t)).slice(0, 12);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="flex h-8 items-center rounded-full border border-current/25 pl-3 text-[13px]">
          #{t}
          <button aria-label={tt("Remove the tag {tag}", { tag: t })} onClick={() => onChange(tags.filter((x) => x !== t))} className="flex size-8 items-center justify-center opacity-55">
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <input
        aria-label={tt("Add a tag")}
        value={text}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
        list="note-tags"
        maxLength={30}
        placeholder={tags.length ? tt("Add a tag") : `# ${tt("Add a tag")}`}
        autoCapitalize="none"
        className="h-8 w-[120px] bg-transparent text-[13px] outline-none placeholder:text-current placeholder:opacity-45"
      />
      <datalist id="note-tags">
        {offered.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

// Notes linked with this one, in either direction, and a button to link another.
export function LinkedNotes({
  id,
  links,
  notes,
  onChange,
}: {
  id: string | null; // null until the note has been saved once
  links: string[];
  notes: Note[];
  onChange: (links: string[]) => void;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const out = links.map((l) => notes.find((n) => n.id === l)).filter((n): n is Note => !!n);
  const back = id ? notes.filter((n) => n.links?.includes(id) && !links.includes(n.id)) : [];
  const linked = new Set([...out, ...back].map((n) => n.id));

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => n.id !== id && !linked.has(n.id))
      .filter((n) => !q || [n.title, n.quote, n.body, n.sourceTitle, ...(n.tags ?? [])].some((s) => s?.toLowerCase().includes(q)))
      .slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, query, id, links]);

  const unlink = (n: Note) => {
    if (links.includes(n.id)) onChange(links.filter((l) => l !== n.id));
    // Linked from the other note: take this one out of its links.
    else if (id) patchNoteQuietly(n.id, { links: (n.links ?? []).filter((l) => l !== id) });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {[...out, ...back].map((n) => (
        <div key={n.id} className="flex items-center gap-1 rounded-xl border border-current/15 pl-3">
          <LinkIcon size={15} className="shrink-0 opacity-55" />
          <Link href={noteHref(n.id)} className="min-w-0 grow truncate py-2.5 pl-1.5 text-[14px]">
            {noteLabel(n)}
          </Link>
          <button aria-label={t("Unlink {name}", { name: noteLabel(n) })} onClick={() => unlink(n)} className="flex size-10 shrink-0 items-center justify-center opacity-55">
            <CloseIcon size={13} />
          </button>
        </div>
      ))}
      <button onClick={() => setPicking(true)} className="flex h-9 items-center gap-2 self-start text-[13px] opacity-60">
        <PlusIcon size={15} /> {t("Link a note")}
      </button>

      <Sheet
        open={picking}
        onClose={() => {
          setPicking(false);
          setQuery("");
        }}
        title="Link a note"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search your notes")}
          aria-label={t("Search your notes")}
          className="h-12 rounded-full border border-ink/15 bg-card px-4 text-[15px] outline-none focus:border-ink"
        />
        <ul className="flex max-h-[46dvh] flex-col overflow-y-auto">
          {choices.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => {
                  onChange([...links, n.id]);
                  setPicking(false);
                  setQuery("");
                }}
                className="flex w-full flex-col gap-0.5 border-b border-line py-2.5 text-left"
              >
                <span className="truncate text-[15px] font-semibold">{noteLabel(n)}</span>
                <span className="label truncate text-[9px] text-muted">
                  {[n.word ? "Word" : n.quote ? "Highlight" : n.checklist ? "List" : "Note", n.sourceTitle, ...(n.tags ?? []).map((t) => `#${t}`)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {choices.length === 0 && <li className="py-6 text-center text-[14px] text-muted">{t("No other note like that.")}</li>}
        </ul>
      </Sheet>
    </div>
  );
}

// "Remind me": a time for this note. The phone rings it; the website only shows it.
export function ReminderSheet({
  open,
  onClose,
  remindAt,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  remindAt?: number;
  onChange: (at: number | undefined) => void;
}) {
  const t = useT();
  const toast = useToast();
  const [custom, setCustom] = useState("");
  const set = async (at: number) => {
    if (!upcoming(at)) return toast({ text: t("Pick a time that’s still to come") });
    onChange(at);
    onClose();
    if (!isNative()) return toast({ text: t("Reminder set for {when}. It rings in the Android app.", { when: remindText(at) }) });
    toast({ text: (await canRing()) ? t("Reminder set for {when}", { when: remindText(at) }) : t("Allow notifications for Stack to be reminded") });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Remind me">
      {remindAt && (
        <p className="rounded-xl bg-card px-3.5 py-3 text-[14px]">
          {upcoming(remindAt) ? t("Set for") : t("Was due")}{" "}
          <b>{remindText(remindAt)}</b>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {quickTimes().map((q) => (
          <button key={q.label} onClick={() => set(q.at)} className="h-11 rounded-full border border-ink/20 px-4 text-[14px] font-semibold">
            {q.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-2">
        <span className="label text-[10px] text-muted">{t("Or pick a day and time")}</span>
        <input
          type="datetime-local"
          value={custom || (remindAt ? localValue(remindAt) : "")}
          min={localValue()}
          onChange={(e) => setCustom(e.target.value)}
          className="h-12 rounded-xl border border-ink/15 bg-card px-3.5 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <button
        onClick={() => set(new Date(custom).getTime())}
        disabled={!custom}
        className="h-12 rounded-full bg-ink text-[15px] font-semibold text-on-ink disabled:opacity-40"
      >
        {t("Set reminder")}
      </button>
      {remindAt && (
        <button
          onClick={() => {
            onChange(undefined);
            onClose();
            toast({ text: t("Reminder removed") });
          }}
          className="h-11 rounded-full border border-ink/20 text-[14px] font-semibold"
        >
          {t("Remove reminder")}
        </button>
      )}
    </Sheet>
  );
}
