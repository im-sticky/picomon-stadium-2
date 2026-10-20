import { Suspense } from "react";
import Image from "next/image";
import { Stage } from "./ui/stage";
import { HomeForm } from "./home-form";
import styles from "./home.module.css";

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return <HomeForm initialError={error === "not-found" ? "not-found" : undefined} />;
}

function Pokeball() {
  return (
    <Image
      className={styles.pokeball}
      src="/sprites/misc/pokeball.png"
      alt=""
      width={64}
      height={64}
      unoptimized
    />
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <main>
      <Stage className={styles.stage}>
        <div className={styles.title}>
          <Pokeball />
          <h1>PICOMON STADIUM</h1>
          <Pokeball />
        </div>
        <Suspense fallback={null}>
          <HomeContent searchParams={searchParams} />
        </Suspense>
        <footer className={styles.credits}>
          <p>
            Sprites and Pokémon data changes from{" "}
            <a href="https://github.com/Rangi42/polishedcrystal" target="_blank" rel="noreferrer">
              Polished Crystal
            </a>{" "}
            by Rangi42 and contributors.
          </p>
          <p>
            Pokémon is © Nintendo, Creatures Inc. and GAME FREAK inc. Unofficial fan project, not
            affiliated with or endorsed by them.
          </p>
        </footer>
      </Stage>
    </main>
  );
}
