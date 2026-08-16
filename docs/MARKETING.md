# Marketing Intelligence

Tracks the path:

Content → Lead → Consultation → Client → Service → Payment → Result → Testimonial → Revenue

## Owner metrics

Leads, consultations, clients, conversion rate, revenue, revenue by source, campaign cost fields (for CPL/CAC/ROAS when cost data exists).

**Revenue-by-content** is fail-closed. Until intake stamps campaign / content / ad / CTA **and** a `LeadAttribution` child exists on the master with a verified payment amount, the answer is **DATA UNAVAILABLE** — not organic. See `docs/LEAD-ATTRIBUTION.md`.

## AI layer

May assist with summaries and prioritization. Must never invent financial transactions, silently alter credit records, execute refunds, or make unsupported legal conclusions.
