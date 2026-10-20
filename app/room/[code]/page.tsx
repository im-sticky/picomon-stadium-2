import { Suspense } from "react";
import { redirect } from "next/navigation";
import { normalizeCode } from "@/lib/codes";
import { draftPool } from "@/lib/draft-pool";
import { LOADING, RoomNotice } from "./room-notice";
import { RoomView } from "./room-view";

async function RoomContent({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  if (!code) redirect("/?error=not-found");
  return <RoomView code={code} pool={draftPool()} />;
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main>
      <Suspense fallback={<RoomNotice message={LOADING} />}>
        <RoomContent params={params} />
      </Suspense>
    </main>
  );
}
