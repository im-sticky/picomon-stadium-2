import { Suspense } from "react";
import { HomeForm } from "./home-form";

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return <HomeForm initialError={error === "not-found" ? "Room not found." : undefined} />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <main>
      <h1>Picomon Stadium</h1>
      <Suspense fallback={null}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
