import { Suspense } from "react";
import MeetingRoom from "@/components/MeetingRoom";

export default function MeetingPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1C1C1C]" />}>
      <MeetingRoom code={params.code} />
    </Suspense>
  );
}
