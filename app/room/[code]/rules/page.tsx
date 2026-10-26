import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Button, ButtonLink } from "@/app/ui/button";
import { RulesScreen } from "@/app/rules/rules-screen";
import { normalizeCode } from "@/lib/codes";

/** BACK to the waiting room. The code is runtime data, so it's read inside Suspense. */
async function BackToRoom({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  if (!code) redirect("/?error=not-found");
  return <ButtonLink href={`/room/${code}`}>BACK</ButtonLink>;
}

/** Draft rules opened from the waiting room (DRAFT RULES). The rules themselves are static. */
export default function RoomRulesPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <RulesScreen
      back={
        <Suspense fallback={<Button disabled>BACK</Button>}>
          <BackToRoom params={params} />
        </Suspense>
      }
    />
  );
}
