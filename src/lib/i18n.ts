"use client";

// The app's language (Settings → Language): English or Hindi. Every string is
// written in English and looked up in the Hindi table (lib/i18n-hi.ts) by
// that same English text, so a missing translation just shows the English.
// "{name}" in a string is filled from `vars`.
import { useCallback, useSyncExternalStore } from "react";
import { HI } from "./i18n-hi";

export type UiLang = "en" | "hi";
export const UI_LANGS: { value: UiLang; label: string; hint: string }[] = [
  { value: "en", label: "English", hint: "English" },
  { value: "hi", label: "हिंदी", hint: "Hindi" },
];

const KEY = "stack.ui.lang";
const listeners = new Set<() => void>();

function stored(): UiLang {
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en"; // storage blocked, or the static build
  }
}
let current: UiLang = stored();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const uiLang = () => current;
/** For toLocaleDateString / toLocaleTimeString. */
export const dateLocale = () => (current === "hi" ? "hi-IN" : "en-GB");

export function setUiLang(l: UiLang) {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked */
  }
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}

export type Vars = Record<string, string | number>;

// In development, untranslated strings are collected so they can be found.
const missing = new Set<string>();

function translate(l: UiLang, s: string, vars?: Vars) {
  let out = s;
  if (l === "hi" && s) {
    const hi = HI[s];
    if (hi) out = hi;
    else if (process.env.NODE_ENV !== "production" && !missing.has(s)) {
      missing.add(s);
      (globalThis as { __stackMissing?: string[] }).__stackMissing = [...missing];
    }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** Outside rendering (toasts, errors, notifications): the current language. */
export const tr = (s: string, vars?: Vars) => translate(current, s, vars);

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** In components: `const t = useT()`. English in the static build, so pages hydrate cleanly. */
export function useT() {
  const l = useSyncExternalStore(subscribe, uiLang, () => "en" as UiLang);
  return useCallback((s: string, vars?: Vars) => translate(l, s, vars), [l]);
}

/** The current language for components (for dates and numbers). */
export const useUiLang = () => useSyncExternalStore(subscribe, uiLang, () => "en" as UiLang);
