"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClientHandoffActions({
  clientId,
  stage,
  canManage,
  role,
}: {
  clientId: string;
  stage: string;
  canManage: boolean;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!canManage) return null;

  async function run(action: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Handoff failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {(role === "CUSTOMER_SERVICE" || role === "OWNER" || role === "ADMIN" || role === "MANAGER") &&
        stage !== "READY_FOR_PROCESSING" && (
          <button
            type="button"
            className="gc-btn gc-btn-primary"
            disabled={loading}
            onClick={() => run("READY_FOR_PROCESSING")}
          >
            Ready for processing
          </button>
        )}
      {(role === "FILE_PREPARER" || role === "OWNER" || role === "ADMIN") && (
        <button
          type="button"
          className="gc-btn gc-btn-outline"
          disabled={loading}
          onClick={() => run("RETURN_TO_SIMON")}
        >
          Return to Simon
        </button>
      )}
      {(role === "OWNER" || role === "ADMIN") && (
        <button
          type="button"
          className="gc-btn gc-btn-ice"
          disabled={loading}
          onClick={() => run("OWNER_REVIEW")}
        >
          Owner review
        </button>
      )}
      {error && <span className="text-sm text-[var(--gc-danger)]">{error}</span>}
    </div>
  );
}
