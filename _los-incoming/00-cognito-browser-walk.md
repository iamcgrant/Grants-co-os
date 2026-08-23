# Cognito browser walk (confirmation) — 2026-08-23

Read-only walk of the public form. Nothing submitted. Confirms the JS extract; adds helper text and required flags.

**Do not treat this as the product.** Acknowledgements + credit-program split only.

- Single scrolling page. Buttons: Submit Application, Cancel. No save/resume.
- SSN: required, full number, **plain text not masked**.
- DPA +$1,800 checkbox is the **only optional** checkbox. All other checkboxes required.
- Radio options (required): "Yes — Requires Credit Hero Score account" | "No — Requires MyFICO login upload".
- Credit Hero / MyFICO uploads: labeled conditional, but **no DOM show/hide** — both visible. LOS must implement real conditionals on `includeCreditRepair`.
- MyFICO copy: minimum qualifying score 620 (instruction, not a computed score).
- Signature: typed name + drawn pad (draw/type toggle + clear) + auto date + proceed checkbox, all required.
- Cancel exists on the public form (was UNKNOWN in the JS workflow extract).

Helper text captured for identity, credit auth, payment, cancellation, and ID upload. Fold into eConsent / INITIAL_DISCLOSURES copy; Charles/counsel still must approve production legal.
