"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { useAccount } from "@/components/account-provider";
import { ProfileEditor } from "@/components/profile-editor";
import { SignInPanel } from "@/components/sign-in";
import { IntroCards } from "@/components/intro-cards";
import { markOnboarded } from "@/components/first-run";
import { getProfile, READING_FOR, saveProfile, type ReadingFor } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { ensureSampleHighlight, SAMPLE_HREF } from "@/lib/sample";
import { setWelcomeStep, welcomeStep, type WelcomeStep } from "@/lib/welcome";
import { useT } from "@/lib/i18n";

// First launch: what Stack does (three cards), what you're reading for, a
// first highlight in the sample article, your name, and only then an account.
export default function Welcome() {
  const router = useRouter();
  const { user, configured } = useAccount();
  const [step, setStepState] = useState<WelcomeStep>("intro");
  const [profile] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const t = useT();

  // Pick up where you left off (back from the sample article, or from Google sign-in).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setStepState(welcomeStep()), []);

  const setStep = (s: WelcomeStep) => {
    setWelcomeStep(s);
    setStepState(s);
  };

  const finish = () => {
    markOnboarded();
    setWelcomeStep(null);
    router.replace("/");
  };

  // Signed in on the last step (email code, or back from Google): done.
  useEffect(() => {
    if (user && step === "account") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, step]);

  const pickGoal = async (value: ReadingFor) => {
    const topics = READING_FOR.find((r) => r.value === value)!.topics;
    await saveProfile({ readingFor: value, interests: profile.interests?.length ? profile.interests : topics });
    setStep("try");
  };

  const tryIt = async () => {
    await ensureSampleHighlight();
    router.push(`${SAMPLE_HREF}&tour=1`);
  };

  // No accounts on this build, or already signed in: nothing to ask.
  const afterProfile = () => (configured && !user ? setStep("account") : finish());

  return (
    <main className="screen flex flex-col px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+28px)]">
      <div className="mx-auto flex w-full max-w-[520px] grow flex-col">
        <Logo size={34} animate className="-ml-1" />

        {step === "intro" && (
          <>
            <h1 className="mt-5 text-[30px] leading-[1.1] font-bold">{t("Stack makes you remember what you read.")}</h1>
            <div className="mt-5 flex grow flex-col">
              <IntroCards onDone={() => setStep("goal")} />
            </div>
          </>
        )}

        {step === "goal" && (
          <>
            <h1 className="mt-6 font-serif text-[34px] leading-[1.1] italic">{t("What are you reading for?")}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              {t("Stack sets up your news and your Today screen around it. You can change it later.")}
            </p>
            <div role="radiogroup" aria-label={t("What are you reading for?")} className="mt-6 flex flex-col gap-2.5">
              {READING_FOR.map((r) => {
                const on = profile.readingFor === r.value;
                return (
                  <button
                    key={r.value}
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickGoal(r.value)}
                    className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border px-4 py-3 text-left ${
                      on ? "border-ink bg-ink text-on-ink" : "border-ink/12 bg-card"
                    }`}
                  >
                    <span className="text-[17px] font-semibold">{t(r.label)}</span>
                    <span className={`label text-[10px] ${on ? "text-on-ink/65" : "text-muted"}`}>{t(r.hint)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "try" && (
          <>
            <h1 className="mt-6 font-serif text-[34px] leading-[1.1] italic">{t("Highlight anything. Stack brings it back.")}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              {t("Here’s a two-minute article with one line already highlighted. Select one more line you like and tap Highlight. Tomorrow morning, both come back in your daily review.")}
            </p>
            <p className="label mt-6 text-[11px] font-medium">{t("Save → Highlight → Remember")}</p>
            <button onClick={tryIt} className="mt-auto h-14 rounded-full bg-ink text-[16px] font-semibold text-on-ink">
              {t("Try it")}
            </button>
            <button onClick={() => setStep("profile")} className="label mt-2 h-12 text-[11px] text-muted underline">
              {t("Skip for now")}
            </button>
          </>
        )}

        {step === "profile" && (
          <>
            <h2 className="label mt-8 text-[11px] font-medium">{t("Make it yours")}</h2>
            <div className="mt-4">
              <ProfileEditor />
            </div>
            <button
              onClick={afterProfile}
              className="mt-auto h-14 rounded-full bg-ink text-[16px] font-semibold text-on-ink"
            >
              {configured && !user ? t("Next") : t("Let’s stack")}
            </button>
          </>
        )}

        {step === "account" && (
          <>
            <h1 className="mt-6 font-serif text-[34px] leading-[1.1] italic">{t("Keep your notes safe on every device?")}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              {t("Stack works fully without an account. Sign in to back up your highlights and notes and have them on your other devices.")}
            </p>
            <div className="mt-6">
              <SignInPanel />
            </div>
            <button onClick={finish} className="label mt-auto h-12 text-[11px] text-muted underline">
              {t("Continue without an account")}
            </button>
          </>
        )}

        {step !== "intro" && (
          <p className={`${step === "goal" ? "mt-auto" : "mt-3"} text-center font-serif text-[15px] text-muted italic`}>
            {t("Scroll less. Stack more.")}
          </p>
        )}
      </div>
    </main>
  );
}
