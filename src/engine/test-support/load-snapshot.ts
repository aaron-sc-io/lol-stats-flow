import championsJson from "../../../data/snapshots/16.22.1/champions.json"
import itemsJson from "../../../data/snapshots/16.22.1/items.json"
import metaJson from "../../../data/snapshots/16.22.1/meta.json"
import type { Snapshot } from "../../data/schema"
import { SnapshotSchema } from "../../data/schema"

/** Node/Vitest-friendly snapshot loader for tests and scripts (the runtime
 * app uses `src/data/loader.ts`'s Vite `import.meta.glob` loader instead —
 * this one uses a plain static JSON import, which both Vitest and `tsx`
 * resolve without a Vite dev-server transform). */
export function loadSnapshotFixture(): Snapshot {
  return SnapshotSchema.parse({ meta: metaJson, champions: championsJson, items: itemsJson })
}
