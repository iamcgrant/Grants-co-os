/** In-memory section save/resume. Blocked until e-sign compliance packet exists. */

import { assertCanPatch, canPatchSections, type AcknowledgmentRow } from "./compliance";
import { LosHttpError } from "./errors";
import { SectionCode } from "./application-contract";

export type StoredSection = {
  section: string;
  body: unknown;
  savedAt: Date;
};

export class SectionStore {
  private readonly data = new Map<string, StoredSection>();

  key(applicationId: string, section: string): string {
    return `${applicationId}:${section}`;
  }

  saveSection(input: {
    applicationId: string;
    section: string;
    body: unknown;
    acks: AcknowledgmentRow[];
    now?: Date;
  }): StoredSection {
    const parsed = SectionCode.safeParse(input.section);
    if (!parsed.success) {
      throw new LosHttpError(422, "UNKNOWN_SECTION", undefined, `Unknown section ${input.section}`);
    }
    if (!canPatchSections(input.acks)) {
      assertCanPatch(input.acks);
    }
    const row: StoredSection = {
      section: parsed.data,
      body: input.body,
      savedAt: input.now ?? new Date(),
    };
    this.data.set(this.key(input.applicationId, parsed.data), row);
    return row;
  }

  getSection(applicationId: string, section: string): StoredSection | null {
    return this.data.get(this.key(applicationId, section)) ?? null;
  }

  all(applicationId: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of this.data) {
      if (k.startsWith(`${applicationId}:`)) out[v.section] = v.body;
    }
    return out;
  }
}
