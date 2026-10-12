"use client";

import { useEffect, useState } from "react";
import { pickFile } from "@/lib/image";
import { getProfile, saveProfile } from "@/lib/profile";
import { useStore } from "@/lib/use-store";
import { Avatar } from "./avatar";
import { ImageCropper } from "./image-cropper";
import { useT } from "@/lib/i18n";

// Photo + name. Saves as you go.
export function ProfileEditor() {
  const t = useT();
  const [profile, ready] = useStore(getProfile, { id: "me", updatedAt: 0 });
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null); // picked, waiting to be framed

  // Fill the field once the stored (or synced) profile arrives.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready) setName(profile.name ?? "");
  }, [ready, profile.name]);

  const choosePhoto = async () => setPhoto(await pickFile());

  return (
    <div className="flex items-center gap-4">
      <button onClick={choosePhoto} aria-label={t("Change profile photo")} className="relative shrink-0">
        <Avatar size={84} />
        <span className="label absolute -right-1 -bottom-1 rounded-full bg-music px-2 py-1 text-[9px] text-white">
          {profile.avatar ? t("Edit") : t("Add")}
        </span>
      </button>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <label className="label text-[10px] text-muted" htmlFor="profile-name">
          {t("Your name")}
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== (profile.name ?? "") && saveProfile({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder={t("What should Stack call you?")}
          autoComplete="name"
          className="h-12 w-full rounded-xl border border-ink/15 bg-card px-4 text-[17px] font-semibold outline-none focus:border-ink"
        />
        {profile.avatar && (
          <button onClick={() => saveProfile({ avatar: undefined })} className="label self-start text-[9px] text-muted underline">
            {t("Remove photo")}
          </button>
        )}
      </div>
      <ImageCropper
        file={photo}
        aspect={1}
        round
        width={384}
        title="Frame your photo"
        onClose={() => setPhoto(null)}
        onDone={async (avatar) => {
          setPhoto(null);
          await saveProfile({ avatar });
        }}
      />
    </div>
  );
}
