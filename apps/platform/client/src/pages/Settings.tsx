import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { GraduationCap, KeyRound, Languages, UserCog } from "lucide-react";
import { trpc } from "../lib/trpc";
import { LANGS, useT } from "../lib/i18n";
import type { Lang } from "../lib/i18n";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Button,
  Card,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from "../components/ui";

/** A labelled form row that wraps arbitrary controls (unlike ui/Field, which owns its input). */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

export default function Settings() {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const { t, lang, setLang } = useT();

  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  // Mentor profile (self-edited; shown wherever the user mentors)
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [languages, setLanguages] = useState("");
  const [availability, setAvailability] = useState("");
  const [mpDirty, setMpDirty] = useState(false);

  // Seed the fields once the profile loads.
  useEffect(() => {
    if (!me.data) return;
    if (me.data.name) setName(me.data.name);
    const p = me.data.profile;
    setHeadline(p.headline ?? "");
    setBio(p.bio ?? "");
    setExpertise(p.expertise.join(", "));
    setLanguages(p.languages.join(", "));
    setAvailability(p.availabilityNote ?? "");
    setMpDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data?.id, me.data?.name]);

  const updateMentorProfile = trpc.auth.updateMentorProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setMpDirty(false);
      toast.success(t("settings.mentorProfileSaved"));
    },
    onError: (e) => toast.error(e.message),
  });
  const splitTags = (s: string) =>
    s
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success(t("settings.profileUpdated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(t("settings.passwordChanged"));
    },
    onError: (e) => toast.error(e.message),
  });

  if (me.isLoading) return <Spinner label="Loading…" />;
  if (!me.data) return null;

  const nameChanged = name.trim() !== (me.data.name ?? "") && name.trim().length >= 2;
  const passwordValid = current.length > 0 && next.length >= 8 && next === confirm;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      {/* Profile */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <UserCog className="h-4 w-4" /> {t("settings.profile")}
        </h2>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={name || me.data.email} className="h-14 w-14 text-base" />
          <div className="text-sm text-ink/55">{me.data.email}</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameChanged) updateProfile.mutate({ name: name.trim() });
          }}
          className="space-y-4"
        >
          <Row label={t("settings.displayName")}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t("settings.yourName")} />
          </Row>
          <Button type="submit" disabled={!nameChanged || updateProfile.isPending}>
            {updateProfile.isPending ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </form>
      </Card>

      {/* Mentor profile — shown for mentoring staff */}
      {["mentor", "manager", "admin", "owner"].includes(
        me.data.activeOrganization?.role ?? "",
      ) && (
        <Card className="p-6">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-navy-900">
            <GraduationCap className="h-4 w-4" /> {t("settings.mentorProfile")}
          </h2>
          <p className="mb-4 text-sm text-ink/55">
            {t("settings.mentorProfileHint")}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMentorProfile.mutate({
                headline: headline || null,
                bio: bio || null,
                expertise: splitTags(expertise),
                languages: splitTags(languages),
                availabilityNote: availability || null,
              });
            }}
            className="space-y-4"
          >
            <Row label={t("settings.headline")} hint={t("settings.headlineHint")}>
              <TextInput
                value={headline}
                maxLength={160}
                onChange={(e) => {
                  setHeadline(e.target.value);
                  setMpDirty(true);
                }}
              />
            </Row>
            <Row label={t("settings.bio")}>
              <Textarea
                value={bio}
                rows={4}
                maxLength={2000}
                onChange={(e) => {
                  setBio(e.target.value);
                  setMpDirty(true);
                }}
                placeholder={t("settings.bioPlaceholder")}
              />
            </Row>
            <div className="grid gap-4 sm:grid-cols-2">
              <Row label={t("settings.expertise")} hint={t("settings.expertiseHint")}>
                <TextInput
                  value={expertise}
                  onChange={(e) => {
                    setExpertise(e.target.value);
                    setMpDirty(true);
                  }}
                />
              </Row>
              <Row label={t("settings.languagesLabel")} hint={t("settings.languagesHint")}>
                <TextInput
                  value={languages}
                  onChange={(e) => {
                    setLanguages(e.target.value);
                    setMpDirty(true);
                  }}
                />
              </Row>
            </div>
            <Row label={t("settings.availability")} hint={t("settings.availabilityHint")}>
              <TextInput
                value={availability}
                maxLength={200}
                onChange={(e) => {
                  setAvailability(e.target.value);
                  setMpDirty(true);
                }}
              />
            </Row>
            <Button type="submit" disabled={!mpDirty || updateMentorProfile.isPending}>
              {updateMentorProfile.isPending ? t("common.saving") : t("settings.saveMentorProfile")}
            </Button>
          </form>
        </Card>
      )}

      {/* Security */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <KeyRound className="h-4 w-4" /> {t("settings.password")}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordValid)
              changePassword.mutate({ currentPassword: current, newPassword: next });
          }}
          className="space-y-4"
        >
          <Row label={t("settings.currentPassword")}>
            <TextInput
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Row>
          <Row label={t("settings.newPassword")} hint={t("settings.newPasswordHint")}>
            <TextInput
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Row>
          <Row label={t("settings.confirmPassword")}>
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {confirm.length > 0 && confirm !== next && (
              <span className="mt-1 block text-xs text-red-500">{t("settings.passwordsDontMatch")}</span>
            )}
          </Row>
          <Button type="submit" disabled={!passwordValid || changePassword.isPending}>
            {changePassword.isPending ? t("settings.updating") : t("settings.changePassword")}
          </Button>
        </form>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <Languages className="h-4 w-4" /> {t("settings.language")}
        </h2>
        <Row
          label={t("settings.interfaceLanguage")}
          hint={t("settings.languageHint")}
        >
          <Select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value as Lang);
              toast.success(t("settings.languageSaved"));
            }}
            className="max-w-xs"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </Row>
      </Card>
    </div>
  );
}
