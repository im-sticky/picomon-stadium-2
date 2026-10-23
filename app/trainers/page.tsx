import { Stage } from "../ui/stage";
import { TrainerGrid } from "./trainer-grid";
import styles from "./trainers.module.scss";

/** Choose a trainer (board 0f): picking one makes it yours and returns to Home. */
export default function TrainersPage() {
  return (
    <main>
      <Stage className={styles.trainers}>
        <h1 className={styles.trainers__title}>CHOOSE A TRAINER</h1>
        <TrainerGrid />
      </Stage>
    </main>
  );
}
