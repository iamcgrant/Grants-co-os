"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  DISCLOSURE_COPY,
  REQUIRED_FOR_SUBMIT,
  type ComplianceDisclosureType,
} from "@/lib/los/compliance";

type StepKey =
  | "account"
  | "disclosures"
  | "BORROWER"
  | "CO_BORROWER"
  | "EMPLOYMENT"
  | "ASSETS"
  | "LIABILITIES"
  | "LOAN"
  | "DECLARATIONS"
  | "DOCUMENTS"
  | "review";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "disclosures", label: "Disclosures" },
  { key: "BORROWER", label: "Borrower" },
  { key: "CO_BORROWER", label: "Co-borrower" },
  { key: "EMPLOYMENT", label: "Employment" },
  { key: "ASSETS", label: "Assets" },
  { key: "LIABILITIES", label: "Liabilities" },
  { key: "LOAN", label: "Loan & property" },
  { key: "DECLARATIONS", label: "Declarations" },
  { key: "DOCUMENTS", label: "Documents" },
  { key: "review", label: "Submit" },
];

function dollarsToCents(v: string): number {
  const n = Number.parseFloat(v.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number | undefined): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

export function ApplyPortal() {
  const [step, setStep] = useState<StepKey>("account");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [loanNumber, setLoanNumber] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState<"register" | "login">("register");

  const [dpaSelected, setDpaSelected] = useState(false);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [signatureFirst, setSignatureFirst] = useState("");
  const [signatureLast, setSignatureLast] = useState("");

  const [borrower, setBorrower] = useState({
    firstNameOnDl: "",
    lastNameOnDl: "",
    dateOfBirth: "",
    ssn: "",
    mobilePhone: "",
    email: "",
    citizenshipOrResidency: "US_CITIZEN",
    militaryService: "NO",
    maritalStatus: "UNMARRIED",
    dependentsCount: 0,
    addresses: [{ street: "", city: "", state: "", zip: "", startOn: "", housingTenure: "RENT" }],
  });

  const [coBorrower, setCoBorrower] = useState({ skip: true, firstNameOnDl: "", lastNameOnDl: "", email: "" });
  const [employment, setEmployment] = useState({
    situation: "CURRENTLY_EMPLOYED",
    employerName: "",
    jobTitle: "",
    startDate: "",
    isCurrent: true,
    monthlyIncome: "",
  });
  const [assets, setAssets] = useState({ institutionName: "", accountType: "CHECKING", accountLast4: "", balance: "" });
  const [liabilities, setLiabilities] = useState({ type: "REVOLVING", monthlyPayment: "", unpaidBalance: "" });
  const [loan, setLoan] = useState({
    loanPurpose: "PURCHASE",
    estimatedPurchasePrice: "",
    downPaymentAmount: "",
    loanAmountNeeded: "",
    propertyType: "SINGLE_FAMILY",
    occupancy: "PRIMARY_RESIDENCE",
    propertyStreet: "",
    propertyCity: "",
    propertyState: "",
    propertyZip: "",
    includeCreditRepair: false,
  });
  const [declarations, setDeclarations] = useState({
    intendOccupyPrimary: "YES",
    ownershipInterestLast3Years: "NO",
    undisclosedBorrowedFunds: "NO",
    newCreditBeforeClosing: "NO",
  });
  const [docMeta, setDocMeta] = useState({ name: "", kind: "IDENTITY" });

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progressPct = useMemo(() => Math.round(((stepIndex + 1) / STEPS.length) * 100), [stepIndex]);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/apply/register");
      if (res.status === 401) {
        setStep("account");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load session");

      if (data.application?.applicationId) {
        setApplicationId(data.application.applicationId);
        setLoanNumber(data.application.loanFile?.loanNumber ?? null);
        if (data.application.submittedAt) {
          setSubmitted(true);
          setStep("review");
        } else {
          setStep("disclosures");
        }
      } else {
        setStep("disclosures");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  async function ensureApplication(): Promise<string> {
    if (applicationId) return applicationId;
    const res = await fetch("/api/los/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.code || "Unable to start application");
    setApplicationId(data.applicationId);
    setLoanNumber(data.loanFile?.loanNumber ?? null);
    return data.applicationId;
  }

  async function saveSection(section: string, body: unknown) {
    const id = await ensureApplication();
    const res = await fetch(`/api/los/applications/${id}/sections/${section}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.code || `Unable to save ${section}`);
    setMessage(`${section} saved`);
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/apply/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...loginForm, rememberMe: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDisclosures(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const id = await ensureApplication();
      const disclosures = REQUIRED_FOR_SUBMIT.map((type) => ({ type, acknowledged: disclosureAccepted }));
      const res = await fetch(`/api/los/applications/${id}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclosures,
          dpaSelected,
          signature: {
            typedFirst: signatureFirst,
            typedLast: signatureLast,
            drawnSignatureKey: "typed-signature",
            dateSigned: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.code || "Compliance failed");
      setLoanNumber(data.loanFile?.loanNumber ?? loanNumber);
      setStep("BORROWER");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compliance failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitApplication() {
    setError("");
    setLoading(true);
    try {
      const id = await ensureApplication();
      await fetch(`/api/los/applications/${id}/qualification`, { method: "POST" });
      const res = await fetch(`/api/los/applications/${id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.code || "Submit failed");
      setSubmitted(true);
      setLoanNumber(data.loanFile?.loanNumber ?? loanNumber);
      setMessage("Application submitted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  async function onUploadDocument(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const id = await ensureApplication();
      const res = await fetch(`/api/los/applications/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: docMeta.kind,
          originalName: docMeta.name,
          mimeType: "application/octet-stream",
          byteSize: 0,
          package: docMeta.kind === "IDENTITY" ? "IDENTITY" : "OTHER",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.code || "Upload failed");
      setMessage("Document recorded. Secure upload connects when storage is configured.");
      setDocMeta({ name: "", kind: "IDENTITY" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (loading && step === "account") {
    return <p className="text-[var(--gc-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="gc-eyebrow mb-2">Mortgage application</p>
        <h1 className="text-2xl md:text-3xl font-[var(--font-display)] mb-2">Home loan application</h1>
        {loanNumber ? <p className="text-sm text-[var(--gc-ice)]">Loan file {loanNumber}</p> : null}
        <div className="mt-4 h-2 rounded-full bg-[var(--gc-glass-strong)] overflow-hidden">
          <div className="h-full bg-[var(--gc-gold)] transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-[var(--gc-muted)] mt-2">
          Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex]?.label}
        </p>
      </div>

      {error ? <p className="text-[var(--gc-danger)] text-sm">{error}</p> : null}
      {message ? <p className="text-[var(--gc-success)] text-sm">{message}</p> : null}

      {step === "account" && (
        <section className="gc-card space-y-4">
          <div className="flex gap-2">
            <button type="button" className={`gc-btn-secondary flex-1 ${authMode === "register" ? "opacity-100" : "opacity-60"}`} onClick={() => setAuthMode("register")}>Create account</button>
            <button type="button" className={`gc-btn-secondary flex-1 ${authMode === "login" ? "opacity-100" : "opacity-60"}`} onClick={() => setAuthMode("login")}>Sign in</button>
          </div>
          {authMode === "register" ? (
            <form onSubmit={onRegister} className="space-y-3">
              <input className="gc-input" placeholder="First name" value={registerForm.firstName} onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })} required />
              <input className="gc-input" placeholder="Last name" value={registerForm.lastName} onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })} required />
              <input className="gc-input" type="email" placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required />
              <input className="gc-input" placeholder="Phone" value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} />
              <input className="gc-input" type="password" placeholder="Password (min 8)" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required minLength={8} />
              <button type="submit" className="gc-btn-primary w-full" disabled={loading}>Create account & continue</button>
            </form>
          ) : (
            <form onSubmit={onLogin} className="space-y-3">
              <input className="gc-input" type="email" placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
              <input className="gc-input" type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
              <button type="submit" className="gc-btn-primary w-full" disabled={loading}>Sign in</button>
            </form>
          )}
        </section>
      )}

      {step === "disclosures" && (
        <section className="gc-card space-y-4">
          <h2 className="text-lg">Required disclosures</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={dpaSelected} onChange={(e) => setDpaSelected(e.target.checked)} className="mt-1" />
            <span>Add Down Payment Assistance ($1,800) to my service package</span>
          </label>
          <ul className="space-y-3 text-sm text-[var(--gc-text-secondary)]">
            {(REQUIRED_FOR_SUBMIT as readonly ComplianceDisclosureType[]).map((type) => (
              <li key={type} className="border-b border-[var(--gc-border)] pb-2">{DISCLOSURE_COPY[type]}</li>
            ))}
          </ul>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={disclosureAccepted} onChange={(e) => setDisclosureAccepted(e.target.checked)} className="mt-1" required />
            <span>I have read and agree to all disclosures above, including non-refundable service acknowledgement and lender audit rights.</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input className="gc-input" placeholder="Signature first name" value={signatureFirst} onChange={(e) => setSignatureFirst(e.target.value)} required />
            <input className="gc-input" placeholder="Signature last name" value={signatureLast} onChange={(e) => setSignatureLast(e.target.value)} required />
          </div>
          <form onSubmit={onDisclosures}>
            <button type="submit" className="gc-btn-primary w-full" disabled={loading || !disclosureAccepted}>Accept & continue</button>
          </form>
        </section>
      )}

      {step === "BORROWER" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Borrower information</h2>
          <input className="gc-input" placeholder="First name (driver license)" value={borrower.firstNameOnDl} onChange={(e) => setBorrower({ ...borrower, firstNameOnDl: e.target.value })} />
          <input className="gc-input" placeholder="Last name (driver license)" value={borrower.lastNameOnDl} onChange={(e) => setBorrower({ ...borrower, lastNameOnDl: e.target.value })} />
          <input className="gc-input" type="date" value={borrower.dateOfBirth} onChange={(e) => setBorrower({ ...borrower, dateOfBirth: e.target.value })} />
          <input className="gc-input" placeholder="SSN (9 digits)" value={borrower.ssn} onChange={(e) => setBorrower({ ...borrower, ssn: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
          <input className="gc-input" placeholder="Mobile phone" value={borrower.mobilePhone} onChange={(e) => setBorrower({ ...borrower, mobilePhone: e.target.value })} />
          <input className="gc-input" type="email" placeholder="Email" value={borrower.email} onChange={(e) => setBorrower({ ...borrower, email: e.target.value })} />
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("BORROWER", borrower);
              setStep("CO_BORROWER");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "CO_BORROWER" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Co-borrower (optional)</h2>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={coBorrower.skip} onChange={(e) => setCoBorrower({ ...coBorrower, skip: e.target.checked })} /> No co-borrower</label>
          {!coBorrower.skip && (
            <>
              <input className="gc-input" placeholder="First name" value={coBorrower.firstNameOnDl} onChange={(e) => setCoBorrower({ ...coBorrower, firstNameOnDl: e.target.value })} />
              <input className="gc-input" placeholder="Last name" value={coBorrower.lastNameOnDl} onChange={(e) => setCoBorrower({ ...coBorrower, lastNameOnDl: e.target.value })} />
              <input className="gc-input" type="email" placeholder="Email" value={coBorrower.email} onChange={(e) => setCoBorrower({ ...coBorrower, email: e.target.value })} />
            </>
          )}
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              if (!coBorrower.skip) await saveSection("CO_BORROWER", coBorrower);
              setStep("EMPLOYMENT");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Continue</button>
        </section>
      )}

      {step === "EMPLOYMENT" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Employment & income</h2>
          <input className="gc-input" placeholder="Employer" value={employment.employerName} onChange={(e) => setEmployment({ ...employment, employerName: e.target.value })} />
          <input className="gc-input" placeholder="Job title" value={employment.jobTitle} onChange={(e) => setEmployment({ ...employment, jobTitle: e.target.value })} />
          <input className="gc-input" type="date" value={employment.startDate} onChange={(e) => setEmployment({ ...employment, startDate: e.target.value })} />
          <input className="gc-input" placeholder="Monthly income (before taxes)" value={employment.monthlyIncome} onChange={(e) => setEmployment({ ...employment, monthlyIncome: e.target.value })} />
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("EMPLOYMENT", {
                jobs: [{
                  situation: employment.situation,
                  employerName: employment.employerName,
                  jobTitle: employment.jobTitle,
                  startDate: employment.startDate,
                  isCurrent: employment.isCurrent,
                  monthlyIncomeBeforeTaxesCents: dollarsToCents(employment.monthlyIncome),
                }],
                otherIncome: [],
              });
              setStep("ASSETS");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "ASSETS" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Assets</h2>
          <input className="gc-input" placeholder="Institution" value={assets.institutionName} onChange={(e) => setAssets({ ...assets, institutionName: e.target.value })} />
          <input className="gc-input" placeholder="Account last 4" value={assets.accountLast4} onChange={(e) => setAssets({ ...assets, accountLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          <input className="gc-input" placeholder="Estimated balance" value={assets.balance} onChange={(e) => setAssets({ ...assets, balance: e.target.value })} />
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("ASSETS", {
                accounts: [{
                  institutionName: assets.institutionName,
                  accountType: assets.accountType,
                  accountLast4: assets.accountLast4,
                  estimatedBalanceCents: dollarsToCents(assets.balance),
                }],
              });
              setStep("LIABILITIES");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "LIABILITIES" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Liabilities</h2>
          <input className="gc-input" placeholder="Monthly payment" value={liabilities.monthlyPayment} onChange={(e) => setLiabilities({ ...liabilities, monthlyPayment: e.target.value })} />
          <input className="gc-input" placeholder="Unpaid balance" value={liabilities.unpaidBalance} onChange={(e) => setLiabilities({ ...liabilities, unpaidBalance: e.target.value })} />
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("LIABILITIES", {
                doesNotApply: false,
                items: [{
                  type: liabilities.type,
                  monthlyPaymentCents: dollarsToCents(liabilities.monthlyPayment),
                  unpaidBalanceCents: dollarsToCents(liabilities.unpaidBalance),
                  toBePaidOff: false,
                }],
              });
              setStep("LOAN");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "LOAN" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Loan & property information</h2>
          <input className="gc-input" placeholder="Estimated purchase price" value={loan.estimatedPurchasePrice} onChange={(e) => setLoan({ ...loan, estimatedPurchasePrice: e.target.value })} />
          <input className="gc-input" placeholder="Down payment" value={loan.downPaymentAmount} onChange={(e) => setLoan({ ...loan, downPaymentAmount: e.target.value })} />
          <input className="gc-input" placeholder="Loan amount needed" value={loan.loanAmountNeeded} onChange={(e) => setLoan({ ...loan, loanAmountNeeded: e.target.value })} />
          <input className="gc-input" placeholder="Property street" value={loan.propertyStreet} onChange={(e) => setLoan({ ...loan, propertyStreet: e.target.value })} />
          <input className="gc-input" placeholder="City" value={loan.propertyCity} onChange={(e) => setLoan({ ...loan, propertyCity: e.target.value })} />
          <input className="gc-input" placeholder="State (2 letters)" value={loan.propertyState} onChange={(e) => setLoan({ ...loan, propertyState: e.target.value.toUpperCase().slice(0, 2) })} />
          <input className="gc-input" placeholder="ZIP" value={loan.propertyZip} onChange={(e) => setLoan({ ...loan, propertyZip: e.target.value })} />
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("LOAN", {
                loanPurpose: loan.loanPurpose,
                estimatedPurchasePriceCents: dollarsToCents(loan.estimatedPurchasePrice),
                downPaymentAmountCents: dollarsToCents(loan.downPaymentAmount),
                loanAmountNeededCents: dollarsToCents(loan.loanAmountNeeded),
                propertyType: loan.propertyType,
                occupancy: loan.occupancy,
                propertyStreet: loan.propertyStreet,
                propertyCity: loan.propertyCity,
                propertyState: loan.propertyState,
                propertyZip: loan.propertyZip,
                specificHomeSelected: "UNKNOWN",
                includeCreditRepair: loan.includeCreditRepair,
                termMonths: 360,
              });
              setStep("DECLARATIONS");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "DECLARATIONS" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Declarations</h2>
          <label className="text-sm">Will you occupy as primary residence?</label>
          <select className="gc-input" value={declarations.intendOccupyPrimary} onChange={(e) => setDeclarations({ ...declarations, intendOccupyPrimary: e.target.value })}>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
          </select>
          <button type="button" className="gc-btn-primary w-full" onClick={async () => {
            try {
              await saveSection("DECLARATIONS", declarations);
              setStep("DOCUMENTS");
            } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
          }}>Save & continue</button>
        </section>
      )}

      {step === "DOCUMENTS" && (
        <section className="gc-card space-y-3">
          <h2 className="text-lg">Documents</h2>
          <p className="text-sm text-[var(--gc-muted)]">Record document metadata now. Secure file upload connects when object storage is configured.</p>
          <form onSubmit={onUploadDocument} className="space-y-3">
            <input className="gc-input" placeholder="Document name" value={docMeta.name} onChange={(e) => setDocMeta({ ...docMeta, name: e.target.value })} required />
            <select className="gc-input" value={docMeta.kind} onChange={(e) => setDocMeta({ ...docMeta, kind: e.target.value })}>
              <option value="IDENTITY">Identity</option>
              <option value="INCOME">Income</option>
              <option value="ASSETS">Assets</option>
              <option value="OTHER">Other</option>
            </select>
            <button type="submit" className="gc-btn-secondary w-full">Record document</button>
          </form>
          <button type="button" className="gc-btn-primary w-full" onClick={() => setStep("review")}>Continue to review</button>
        </section>
      )}

      {step === "review" && (
        <section className="gc-card space-y-4">
          <h2 className="text-lg">Review & submit</h2>
          {submitted ? (
            <p className="text-[var(--gc-success)]">Your application has been submitted. Loan file {loanNumber} is in the internal LOS workflow.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--gc-muted)]">Submit creates your permanent LoanFile and moves the application into staff review.</p>
              <button type="button" className="gc-btn-primary w-full" disabled={loading} onClick={onSubmitApplication}>Submit application</button>
            </>
          )}
        </section>
      )}

      <nav className="flex justify-between gap-2 pt-4">
        <button type="button" className="gc-btn-secondary" disabled={stepIndex <= 0} onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}>Back</button>
        <button type="button" className="gc-btn-secondary" disabled={stepIndex >= STEPS.length - 1} onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}>Next</button>
      </nav>
    </div>
  );
}
