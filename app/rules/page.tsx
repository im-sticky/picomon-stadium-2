import { ButtonLink } from "../ui/button";
import { RulesScreen } from "./rules-screen";

/** Draft rules on their own: BACK goes Home. Static. */
export default function RulesPage() {
  return <RulesScreen back={<ButtonLink href="/">BACK</ButtonLink>} />;
}
