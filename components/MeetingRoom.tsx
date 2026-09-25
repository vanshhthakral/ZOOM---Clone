"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { compactMeetingCode, endMeeting, getMeeting, type Participant } from "@/lib/api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

type Panel = "none" | "participants" | "chat";

type LocalParticipant = Participant & { locallyMuted: boolean };

export default function MeetingRoom({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selfName = searchParams.get("name")?.trim() || "You";
  const compact = compactMeetingCode(code);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [title, setTitle] = useState("Meeting");
  const [meetingCodeLabel, setMeetingCodeLabel] = useState(code);
  const [participants, setParticipants] = useState<LocalParticipant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [panel, setPanel] = useState<Panel>("none");
  const [toast, setToast] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const others = useMemo(
    () =>
      participants.filter(
        (p) => p.name.trim().toLowerCase() !== selfName.toLowerCase()
      ),
    [participants, selfName]
  );

  const isHost = useMemo(() => {
    const self = participants.find((p) => p.name.trim().toLowerCase() === selfName.toLowerCase());
    return self?.is_host ?? selfName.toLowerCase() === "you";
  }, [participants, selfName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meeting = await getMeeting(compact);
        if (cancelled) return;
        if (!meeting) {
          setLoadError("This meeting could not be found.");
          return;
        }
        setTitle(meeting.title);
        setMeetingCodeLabel(meeting.meeting_code);
        setParticipants(
          (meeting.participants ?? []).map((p) => ({ ...p, locallyMuted: false }))
        );
      } catch {
        if (!cancelled) setLoadError("Could not load this meeting.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compact]);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        setHasMedia(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setHasMedia(false);
        setMicOn(false);
        setCamOn(false);
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hasMedia && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [hasMedia, camOn]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  }

  async function handleEnd() {
    setEnding(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      await endMeeting(compact);
    } catch {
      /* still leave the room */
    }
    router.push("/");
  }

  function muteParticipant(id: string) {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, locallyMuted: true } : p)));
    setToast("Participant muted");
  }

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setToast("Participant removed");
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1C1C1C] text-white">
        <p className="text-sm text-white/70">{loadError}</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-zoom-blue px-4 py-2 text-sm"
          onClick={() => router.push("/")}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#1C1C1C] text-white">
      <header className="flex h-12 shrink-0 items-center justify-between px-5 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="text-xs text-white/50">Meeting ID: {meetingCodeLabel}</p>
        </div>
        <p className="tabular-nums text-white/80">{formatElapsed(elapsed)}</p>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center p-4">
          <div
            className={`grid h-full w-full max-w-6xl gap-3 ${
              others.length > 0 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            }`}
          >
            <VideoTile
              name={`${selfName} (You)`}
              micOn={micOn}
              showVideo={hasMedia && camOn}
              videoRef={videoRef}
              initials={initials(selfName)}
            />
            {others.map((p) => (
              <VideoTile
                key={p.id}
                name={p.locallyMuted ? `${p.name} (muted)` : p.name}
                micOn={!p.locallyMuted}
                showVideo={false}
                initials={initials(p.name)}
              />
            ))}
          </div>
        </div>

        {panel === "participants" && (
          <aside className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-[#242424]">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">Participants ({participants.length})</h2>
              <button type="button" className="text-white/60 hover:text-white" onClick={() => setPanel("none")}>
                ✕
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-4">
              {participants.map((p) => {
                const self = p.name.trim().toLowerCase() === selfName.toLowerCase();
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zoom-blue text-xs font-semibold">
                        {initials(p.name)}
                      </span>
                      <span className="text-sm">
                        {p.name}
                        {self ? " (You)" : ""}
                        {p.is_host ? " · Host" : ""}
                        {p.locallyMuted ? " · Muted" : ""}
                      </span>
                    </div>
                    {isHost && !self && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Mute"
                          className="rounded p-1 text-white/70 hover:bg-white/10"
                          onClick={() => muteParticipant(p.id)}
                        >
                          <MicOffIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          className="rounded p-1 text-white/70 hover:bg-white/10"
                          onClick={() => removeParticipant(p.id)}
                        >
                          <RemoveIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {panel === "chat" && (
          <aside className="flex h-full w-80 shrink-0 flex-col border-l border-white/10 bg-[#242424]">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">Chat</h2>
              <button type="button" className="text-white/60 hover:text-white" onClick={() => setPanel("none")}>
                ✕
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white/40">
              No messages yet. Chat is coming soon.
            </div>
          </aside>
        )}
      </div>

      <footer className="relative flex h-[88px] shrink-0 items-center justify-center bg-[#1C1C1C] pb-3">
        <div className="flex items-end gap-5">
          <ControlButton
            label={micOn ? "Mute" : "Unmute"}
            active={micOn}
            danger={!micOn}
            onClick={toggleMic}
            icon={micOn ? <MicIcon /> : <MicOffIcon />}
          />
          <ControlButton
            label={camOn && hasMedia ? "Stop Video" : "Start Video"}
            active={camOn && hasMedia}
            danger={!camOn || !hasMedia}
            onClick={toggleCam}
            icon={camOn && hasMedia ? <CamIcon /> : <CamOffIcon />}
          />
          <ControlButton
            label="Participants"
            active={panel === "participants"}
            onClick={() => setPanel(panel === "participants" ? "none" : "participants")}
            icon={<PeopleIcon />}
          />
          <ControlButton
            label="Chat"
            active={panel === "chat"}
            onClick={() => setPanel(panel === "chat" ? "none" : "chat")}
            icon={<ChatIcon />}
          />
          <ControlButton label="Share Screen" disabled icon={<ShareIcon />} />
          <ControlButton label="Record" disabled icon={<RecordIcon />} />
          <button
            type="button"
            disabled={ending}
            onClick={handleEnd}
            className="mb-0.5 flex h-12 min-w-[72px] items-center justify-center rounded-lg bg-[#DE2828] px-5 text-sm font-medium hover:bg-[#c42222] disabled:opacity-60"
          >
            End
          </button>
        </div>
        {toast && (
          <div className="absolute right-6 top-3 rounded-md bg-black/70 px-3 py-2 text-xs text-white">{toast}</div>
        )}
      </footer>
    </div>
  );
}

function VideoTile({
  name,
  micOn,
  showVideo,
  videoRef,
  initials: letters,
}: {
  name: string;
  micOn: boolean;
  showVideo: boolean;
  videoRef?: RefObject<HTMLVideoElement>;
  initials: string;
}) {
  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-xl bg-[#2D2D2D]">
      {showVideo && videoRef ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
      ) : (
        <div className="flex h-full min-h-[240px] items-center justify-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#4B4B4B] text-3xl font-semibold">
            {letters}
          </span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded bg-black/55 px-2 py-1 text-xs">
        {micOn ? <MicIcon className="h-3.5 w-3.5" /> : <MicOffIcon className="h-3.5 w-3.5 text-red-400" />}
        {name}
      </div>
    </div>
  );
}

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
  danger,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-[76px] flex-col items-center gap-1 text-[11px] text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          danger ? "bg-[#DE2828]" : active ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
        }`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function MicIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}

function MicOffIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 11h-2a5 5 0 0 1-.4 2L15 11.4V6a3 3 0 0 0-5.7-1.3L7.7 3.1A5 5 0 0 1 17 6v3.6l2.3 2.3c.4-.6.6-1.4.7-2.1zM4.3 3 3 4.3 9 10.3V11a3 3 0 0 0 3.7 2.9l1.5 1.5A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.9V21h2v-3.1c.7-.1 1.4-.3 2-.6L19.7 21 21 19.7 4.3 3z" />
    </svg>
  );
}

function CamIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 10.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5l5 4v-11l-5 4z" />
    </svg>
  );
}

function CamOffIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.3 2 2 3.3 4.7 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11c.3 0 .5 0 .8-.1L20.7 22 22 20.7 3.3 2zM17 12.2 22 16V8l-5 3.8V8.8L8.2 4H15a2 2 0 0 1 2 2v6.2z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 8 12zm8 2c-3 0-8 1.5-8 4.5V20h16v-1.5c0-3-5-4.5-8-4.5zM8 14c-.7 0-1.4.1-2 .2-2.4.6-5 1.8-5 3.8V20h5v-1.5c0-1.7.8-3.1 2-4.2A9.5 9.5 0 0 0 8 14z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5h13a2 2 0 0 1 2 2v3l4-3v10l-4-3v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function RemoveIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 7h12v2H6zm2 3h8l-1 9H9L8 10zm3-6h2l1 2h4v2H6V6h4l1-2z" />
    </svg>
  );
}
