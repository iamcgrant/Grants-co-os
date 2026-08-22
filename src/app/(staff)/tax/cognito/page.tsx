import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";
import { requireTaxStaff } from "@/lib/tax/access";
import { listCachedCognitoBoard } from "@/lib/integrations/cognito/workspace";
import { probeCognitoHealth } from "@/lib/integrations/cognito/health";
import { cognitoPublicStatus } from "@/lib/integrations/cognito/config";
import { CognitoPullForm } from "@/components/tax/CognitoPullForm";

export default async function CognitoWorkspacePage() {
  const { user, denied } = await requireTaxStaff();
  if (denied || !user) return <p>Access denied.</p>;

  const [board, probe] = await Promise.all([listCachedCognitoBoard(), probeCognitoHealth()]);
  const canManage = hasPermission(user.role, "MANAGE_OPERATIONS");
  const publicStatus = cognitoPublicStatus();
  const matched = board.filter((row) => row.grantsClientId).length;

  return (
    <div className="gc-fade-up">
      <p className="gc-eyebrow mb-2">Tax</p>
      <h1 className="text-4xl md:text-5xl mb-2">Cognito</h1>
      <p className="gc-section-sub mb-6 max-w-3xl">
        Official Cognito Forms API lists submitted tax/client forms in OS. Store COGNITO_API_KEY as env — never
        commit it. No scrape.
      </p>

      <div className="gc-grid-dense gc-grid-dense-4 mb-8">
        {[
          ["Matched submissions", String(board.length)],
          ["Linked clients", String(matched)],
          ["API key", publicStatus.configured ? "Set" : "Missing"],
          ["Official API", "Yes"],
        ].map(([label, value]) => (
          <div key={label} className="gc-card">
            <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">{label}</p>
            <p className="display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="gc-card mb-10 max-w-3xl">
        <p className="text-[0.62rem] tracking-[0.14em] uppercase text-[var(--gc-muted)] mb-2">API health</p>
        <p className="text-lg display">{probe.status.replaceAll("_", " ")}</p>
        <p className="text-sm text-[var(--gc-muted)] mt-2">{probe.detail}</p>
        {probe.lastSuccessAt ? (
          <p className="text-sm text-[var(--gc-muted)] mt-1">
            Last official pull {new Date(probe.lastSuccessAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="mb-10">
          <CognitoPullForm />
        </div>
      ) : (
        <p className="text-sm text-[var(--gc-muted)] mb-10">View only — processing can pull official submissions.</p>
      )}

      <section>
        <h2 className="text-2xl mb-3">
          Submitted forms <span className="text-[var(--gc-muted)] text-base">({board.length})</span>
        </h2>
        <div className="divide-y divide-[var(--gc-border)] gc-panel px-4">
          {board.length === 0 ? (
            <p className="py-4 text-sm text-[var(--gc-muted)]">
              No matched Cognito submissions yet. Pull via the official API when COGNITO_API_KEY is set.
            </p>
          ) : (
            board.map((row) => (
              <div key={`${row.grantsClientId}-${row.entryId}`} className="py-4 flex justify-between gap-4">
                <div>
                  <p className="font-medium">{row.formName}</p>
                  <p className="text-sm text-[var(--gc-muted)]">
                    Entry {row.entryId}
                    {row.submittedAt ? ` · ${new Date(row.submittedAt).toLocaleDateString()}` : ""}
                    {" · "}
                    {row.clientName} · {row.grantsClientId}
                  </p>
                </div>
                <Link href={`/clients/${row.grantsClientId}`} className="gc-status">
                  Client 360
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
