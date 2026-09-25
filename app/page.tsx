"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import JoinMeetingModal from "@/components/JoinMeetingModal";
import NewMeetingModal from "@/components/NewMeetingModal";
import {
  compactMeetingCode,
  createInstantMeeting,
  fetchMeetings,
  getMeeting,
  joinMeeting,
  type Meeting,
} from "@/lib/api";

type Tab = "upcoming" | "recent";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5v-10l-4 3.5z" />
    </svg>
  );
}

function JoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="M15 10.5 21 7v10l-6-3.5" />
      <path d="M8 12h4M10 10v4" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function ScreenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.2 4.2 6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async (status: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeetings(status);
      setMeetings(data);
    } catch {
      setError("Could not load meetings. Is the API running on port 8000?");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function confirmInstant() {
    setBusy(true);
    try {
      const meeting = await createInstantMeeting();
      const code = compactMeetingCode(meeting.meeting_code);
      await joinMeeting(code, "You");
      router.push(`/meeting/${code}`);
    } catch {
      setBusy(false);
      setNewOpen(false);
      setError("Could not start an instant meeting.");
    }
  }

  async function submitJoin(codeOrLink: string, name: string) {
    setBusy(true);
    setJoinError(null);
    const code = compactMeetingCode(codeOrLink);
    try {
      const meeting = await getMeeting(code);
      if (!meeting) {
        setJoinError("Invalid meeting ID. Please check and try again.");
        setBusy(false);
        return;
      }
      await joinMeeting(meeting.meeting_code, name.trim());
      router.push(`/meeting/${code}?name=${encodeURIComponent(name.trim())}`);
    } catch {
      setJoinError("Invalid meeting ID. Please check and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 h-14 border-b border-zoom-border bg-white">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-10">
            <span className="text-[22px] font-semibold tracking-tight text-zoom-blue">zoom</span>
            <nav className="flex items-center gap-7 text-[15px]">
              <span className="border-b-2 border-zoom-blue pb-3.5 pt-4 font-medium text-zoom-blue">Home</span>
              <span className="cursor-default pb-3.5 pt-4 text-zoom-gray">Chat</span>
              <span className="cursor-default pb-3.5 pt-4 text-zoom-gray">Meetings</span>
              <span className="cursor-default pb-3.5 pt-4 text-zoom-gray">Contacts</span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zoom-text hover:bg-zoom-muted"
            >
              Host <ChevronDown />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoom-blue text-xs font-semibold text-white">
              YO
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap gap-5">
          <ActionTile
            label="New Meeting"
            variant="new"
            onClick={() => setNewOpen(true)}
            icon={<VideoIcon className="h-8 w-8 text-white" />}
          />
          <ActionTile
            label="Join"
            variant="outline"
            onClick={() => {
              setJoinError(null);
              setJoinOpen(true);
            }}
            icon={<JoinIcon className="h-8 w-8 text-zoom-blue" />}
          />
          <ActionTile
            label="Schedule"
            variant="outline"
            onClick={() => console.log("Schedule clicked - not implemented yet")}
            icon={<CalendarIcon className="h-8 w-8 text-zoom-blue" />}
          />
          <ActionTile
            label="Share Screen"
            variant="outline"
            onClick={() => console.log("Share Screen")}
            icon={<ScreenIcon className="h-8 w-8 text-zoom-blue" />}
          />
        </div>

        <section className="mt-12">
          <div className="flex border-b border-zoom-border text-[15px]">
            {(["upcoming", "recent"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px mr-8 pb-3 font-medium capitalize ${
                  tab === key
                    ? "border-b-2 border-zoom-blue text-zoom-blue"
                    : "text-zoom-gray hover:text-zoom-text"
                }`}
              >
                {key === "upcoming" ? "Upcoming" : "Recent"}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {loading && (
              <p className="rounded-xl bg-zoom-muted px-5 py-8 text-sm text-zoom-gray">Loading meetings…</p>
            )}
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>
            )}
            {!loading && !error && meetings.length === 0 && (
              <p className="rounded-xl bg-zoom-muted px-5 py-10 text-center text-sm text-zoom-gray">
                No {tab} meetings.
              </p>
            )}
            {!loading &&
              meetings.map((m) => (
                <article
                  key={m.id}
                  className="flex flex-col gap-4 rounded-xl border border-zoom-border bg-zoom-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="text-base font-semibold text-zoom-text">{m.title}</h3>
                    <p className="mt-1 text-sm text-zoom-gray">
                      {formatWhen(tab === "recent" ? m.ended_at ?? m.scheduled_at : m.scheduled_at)}
                    </p>
                    <p className="mt-1 text-sm text-zoom-gray">
                      Meeting ID: {m.meeting_code} · Host: {m.host_name} · {m.duration_minutes} min
                    </p>
                  </div>
                  {tab === "upcoming" ? (
                    <button
                      type="button"
                      className="h-9 shrink-0 rounded-lg bg-zoom-blue px-5 text-sm font-medium text-white hover:bg-zoom-blue-hover"
                      onClick={() => {
                        setJoinError(null);
                        setJoinOpen(true);
                      }}
                    >
                      Start
                    </button>
                  ) : (
                    <span className="text-sm text-zoom-gray">Ended</span>
                  )}
                </article>
              ))}
          </div>
        </section>
      </main>

      <NewMeetingModal
        open={newOpen}
        busy={busy}
        onCancel={() => !busy && setNewOpen(false)}
        onConfirm={confirmInstant}
      />
      <JoinMeetingModal
        open={joinOpen}
        busy={busy}
        error={joinError}
        onCancel={() => {
          if (!busy) {
            setJoinOpen(false);
            setJoinError(null);
          }
        }}
        onSubmit={submitJoin}
      />
    </div>
  );
}

function ActionTile({
  label,
  icon,
  variant,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  variant: "new" | "outline";
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex w-[148px] flex-col items-center gap-3">
      <span
        className={
          variant === "new"
            ? "flex h-[92px] w-[148px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#F26D21] via-[#E85D24] to-[#0E71EB] shadow-sm transition group-hover:brightness-105"
            : "flex h-[92px] w-[148px] items-center justify-center rounded-2xl border-[1.5px] border-zoom-blue bg-white transition group-hover:bg-[#F3F8FE]"
        }
      >
        {icon}
      </span>
      <span className="text-sm font-medium text-zoom-text">{label}</span>
    </button>
  );
}
