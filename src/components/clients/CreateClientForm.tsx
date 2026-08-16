"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateClientForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState<
    { grantsClientId: string; firstName: string; lastName: string; email: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function submit(forceCreate = false) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, forceCreate }),
      });
      const data = await res.json();
      if (data.status === "POSSIBLE_DUPLICATE") {
        setDuplicates(data.duplicates);
        setMessage("Possible duplicate found. Confirm to create anyway, or open the existing client.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed");
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
      setDuplicates([]);
      setMessage(`Created ${data.client.grantsClientId}`);
      router.push(`/clients/${data.client.grantsClientId}`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(false);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <h2 className="text-2xl mb-4">New Client</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {(["firstName", "lastName", "email", "phone"] as const).map((field) => (
          <input
            key={field}
            className="gc-input"
            placeholder={field === "firstName" ? "First name" : field === "lastName" ? "Last name" : field === "email" ? "Email" : "Phone"}
            type={field === "email" ? "email" : "text"}
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            required={field !== "phone"}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className="gc-btn gc-btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Create Client"}
        </button>
        {duplicates.length > 0 && (
          <button
            type="button"
            className="gc-btn gc-btn-ghost"
            onClick={() => void submit(true)}
          >
            Create Anyway
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-[var(--gc-muted)]">{message}</p>}
      {duplicates.length > 0 && (
        <ul className="mt-3 text-sm space-y-1">
          {duplicates.map((d) => (
            <li key={d.grantsClientId}>
              <a className="text-[var(--gc-gold)]" href={`/clients/${d.grantsClientId}`}>
                {d.grantsClientId} — {d.firstName} {d.lastName} ({d.email})
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
