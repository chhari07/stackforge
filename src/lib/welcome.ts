"use client";

// Where first launch is up to, so it picks up again after the sample article
// or a Google sign-in (both leave the welcome screen). Cleared when it's done;
// "done" itself is the onboarded flag in components/first-run.tsx.
export type WelcomeStep = "intro" | "goal" | "try" | "profile" | "account";
const KEY = "stack.welcome.step";
const STEPS: WelcomeStep[] = ["intro", "goal", "try", "profile", "account"];

export function welcomeStep(): WelcomeStep {
  try {
    const s = localStorage.getItem(KEY) as WelcomeStep | null;
    return s && STEPS.includes(s) ? s : "intro";
  } catch {
    return "intro";
  }
}

export function setWelcomeStep(s: WelcomeStep | null) {
  try {
    if (s) localStorage.setItem(KEY, s);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

/** True while first launch is still running (the sample article's tour). */
export function inWelcome() {
  try {
    return localStorage.getItem("stack.onboarded") !== "1";
  } catch {
    return false;
  }
}
