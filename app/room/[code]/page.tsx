import { Suspense } from "react";
import { redirect } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { RoomView } from "./room-view";

async function RoomContent({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  if (!code) redirect("/?error=not-found");
  return <RoomView code={code} />;
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main>
      <Suspense fallback={<p>Loading…</p>}>
        <RoomContent params={params} />
      </Suspense>
    </main>
  );
}
