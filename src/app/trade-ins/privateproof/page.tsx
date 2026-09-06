import { permanentRedirect } from "next/navigation";

/**
 * The buyer page moved to /above-board-cars on 6 Sep (owner: the old address still
 * carried the working name). Anything holding the old link lands on the new page.
 * The internal route id "privateproof" on deals is unaffected.
 */
export default function PrivateProofMoved() {
  permanentRedirect("/above-board-cars");
}
