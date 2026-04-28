// Cresa-style lease abstract template structure
export const LEASE_ABSTRACT_TEMPLATE = `You are producing a professional Lease Summary / Abstract. Follow this EXACT structure and section order. Fill in every field from the lease document. If a field is not found in the lease, write "Silent in Lease."

## FORMAT:
---
# Lease Summary

**Company Name:** [Tenant Company]
**Building Name:** [Building/Property Name]
**Address:** [Full Address]
**Lease Type:** [Renewal / Expansion / New Lease]
**Abstract Date:** [Today's Date]

---

### Premises
- [X] rentable square feet
- Method of Measurement: [if stated]

### Amendments
List each amendment with page references and bullet-point summaries. If none, state "No amendments."

### Landlord
[Landlord entity name] | [City, ST]

### Term
- Duration: [X years]
- Commencement Date: [date]
- Expiration Date: [date]
- Article/Section/Page reference if available

### Size
[Rentable SF and Usable SF if stated]

### Rent Schedule

| Period | Rent/SF | Rent/Month | Rent/Year |
|--------|---------|------------|-----------|
| Year 1 | $XX.XX  | $XX,XXX.XX | $XXX,XXX.XX |
| Year 2 | ... | ... | ... |
[Continue for all years]

### Rent Payment Address
[Address or "Silent in Lease"]

### Lease Type
[Full Service / Net / Modified Gross / etc.]

### Electricity
[Included or separately metered, details]

### Abandonment
[Terms or "Silent in Lease"]

### Additional Provisions
[Key provisions or "Silent in Lease"]

### Alterations & Additions
[Terms or "Silent in Lease"]

### Landlord Services
[Services provided or "Silent in Lease"]

### Operating Expenses & Taxes
[Base year, cap, pass-through details or "Silent in Lease"]

### Exhibits
[List all exhibits referenced]

### Improvements / Tenant Improvements
[TI allowance, details or "Silent in Lease"]

### Parking
[Ratio, cost, reserved/unreserved or "Silent in Lease"]

### Right of Refusal
[Terms or "Silent in Lease"]

### Extension Option
[Terms, notice period, rent basis or "Silent in Lease"]

### Expansion Option
[Terms or "Silent in Lease"]

### Cancellation Option
[Terms, penalty or "Silent in Lease"]

### Holdover
[Rate, terms or "Silent in Lease"]

### Insurance - Landlord
[Requirements or "Silent in Lease"]

### Insurance - Tenant
[Requirements or "Silent in Lease"]

### Late Charge
[Percentage, grace period or "Silent in Lease"]

### Maintenance - Landlord
[Responsibilities or "Silent in Lease"]

### Maintenance - Tenant
[Responsibilities or "Silent in Lease"]

### Non-Disturbance
[Terms or "Silent in Lease"]

### Permitted Uses
[Permitted uses or "Silent in Lease"]

### Relocation
[Terms or "Silent in Lease"]

### Restoration
[Terms or "Silent in Lease"]

### Right to Audit
[Terms or "Silent in Lease"]

### Right to Offset
[Terms or "Silent in Lease"]

### Self-Help
[Terms or "Silent in Lease"]

### Assignment & Subletting
[Terms, consent requirements or "Silent in Lease"]

### Signage
[Terms or "Silent in Lease"]

### Security Deposit
[Amount, terms or "Silent in Lease"]

### Building Hours and Holidays
[Hours, holiday schedule or "Silent in Lease"]

### Notice to Landlord
[Notice address or "Silent in Lease"]

### Additional Lease Comments
[Any other notable terms]

---
*This document has been prepared based on available information and professional interpretation. Reasonable care has been taken to ensure its accuracy. We encourage every client to review the information prior to relying on it for action or decision-making.*
---

CRITICAL INSTRUCTIONS - MAXIMUM DETAIL:
1. Fill in EVERY section above. Do NOT skip or summarize - provide the FULL detail from the lease for each field.
2. For rent schedules: list EVERY year of the term with Rent/SF, Rent/Month, and Rent/Year. Calculate monthly and annual amounts if only per-SF rates are given. Show escalation percentages.
3. For each section, include the Article #, Section #, and Page # references from the lease when available.
4. Quote exact dollar amounts, dates, percentages, and square footage numbers - never round or approximate.
5. For options (extension, expansion, cancellation, ROFO/ROFR): include ALL details - notice periods, pricing mechanisms, number of options, option term lengths, and any conditions.
6. For insurance: list exact coverage types and minimum amounts required.
7. For operating expenses: include base year, cap rates, exclusions, gross-up provisions, and audit rights.
8. For TI/improvements: include exact allowance per SF, total amount, construction timeline, and any landlord contribution details.
9. For assignment/subletting: include consent requirements, recapture rights, profit sharing, and any pre-approved transfers.
10. List ALL exhibits and addenda referenced in the lease with brief descriptions.
11. Include any guarantor information, renewal rights, co-tenancy clauses, exclusive use provisions, or other non-standard terms under "Additional Lease Comments."
12. If a clause is complex, use sub-bullets to break it down - never collapse detail into a single line.
13. DO NOT write "See lease for details" - extract and state the actual details.`;

// Deal Terms Matrix template (Summary of Proposals)
export const MATRIX_TEMPLATE = `You are producing a professional "Summary of Proposals" deal terms matrix. Follow this EXACT structure and formatting. Extract every detail from the attached lease/proposal documents.

## RULES:
- Create ONE column per distinct offer option.
- If a single lease document contains multiple options (e.g. Option A and Option B, or a 5-year term vs a 10-year term), each option MUST get its own column.
- Use EXACT dollar amounts, dates, percentages, and SF numbers from the documents. Never round or approximate.
- If a field is not stated in a document, write "Silent" or leave blank.
- The output MUST be a clean markdown table that exports perfectly to Word.

## FORMAT:

# Summary of Proposals

| | [Street Address, City, State] | [Street Address, City, State] | ... |
|---|---|---|---|
| **Lease Terms** | **Landlord Offer #1A** | **Landlord Offer #1B** | ... |
| **Premises:** | [XX,XXX RSF] | [XX,XXX RSF] | ... |
| **Term:** | [X years] | [X years] | ... |
| **Lease Commencement Date:** | [Month Day, Year] | [Month Day, Year] | ... |
| **Rental Abatement:** | [X months / None] | [X months / None] | ... |
| **Base Rental Rate:** | [$XX.XX/NNN or FS] | [$XX.XX/NNN or FS] | ... |
| **Average Annual Cost Over Term:** | [$XXX,XXX] | [$XXX,XXX] | ... |
| **Escalation:** | [X.XX%] | [X.XX%] | ... |
| **Operating Expenses & Real Estate Taxes:** | [$XX.XX PSF or included] | [$XX.XX PSF or included] | ... |
| **Tenant Improvement Allowance:** | [$XX.XX/PSF] | [$XX.XX/PSF] | ... |
| **Termination Option:** | [Terms / None] | [Terms / None] | ... |

CRITICAL INSTRUCTIONS:
1. Use the EXACT row labels shown above in bold. Do not rename or reorder them.
2. Use the PHYSICAL STREET ADDRESS as column headers.
3. If a single lease/proposal contains multiple options, create a separate column for EACH option.
4. Calculate Average Annual Cost Over Term.
5. Include ALL offers and ALL options from ALL attached documents.
6. Keep the table compact and clean.
7. After the table, optionally add a brief "Notes" section.`;

// Cresa-style Comparison of Options template
export const COMP_COMPARISON_TEMPLATE = `You are producing a professional "Comparison of Options" analysis. Follow this EXACT structure. Extract every detail from the attached lease offer documents.

## RULES:
- Create ONE column per offer/proposal. Group columns by building address.
- If a building has multiple rounds of offers, each round gets its own column.
- ONLY include the number of columns needed.
- Use exact dollar amounts, dates, percentages, and SF numbers from the documents. Never round.

## FORMAT:

# [Client/Tenant Name]: Comparison of Options

## Assumptions

| | [Building 1 Address] | [Building 2 Address] | ... |
|---|---|---|---|
| | [Offer Label #1] | [Offer Label #1] | ... |
| Premises Size | [X,XXX SF] | ... | ... |
| Lease Commencement | [date] | ... | ... |
| Lease Expiration | [date] | ... | ... |
| Lease Term | [X Yrs X Mo] | ... | ... |
| Base Rent | [$XX.XX PSF, FS/NNN] | ... | ... |
| All-In Rent | [$XX.XX PSF] | ... | ... |
| Rent Escalation | [X.XX%] | ... | ... |
| Free Rent | [X Mos (details)] | ... | ... |
| Improvement Allowance | [$XX.XX PSF] | ... | ... |

## Full Term Totals

| | [Building 1] | [Building 2] | ... |
|---|---|---|---|
| Cumulative Rent | [$XXX,XXX] | ... | ... |
| Average Annual Rent | [$XXX,XXX] | ... | ... |
| Net Present Value | [$XXX,XXX] | ... | ... |

CRITICAL INSTRUCTIONS:
1. Extract and calculate ALL numbers.
2. Calculate cumulative rent, average annual rent, and NPV (use 8% discount rate unless specified otherwise).
3. Show rent escalations applied year-over-year in the cash flow tables.
4. Include ALL footnotes explaining credits, buildout assumptions, or special conditions.`;

// Cash Flow Analysis template
export const CASHFLOW_TEMPLATE = `You are producing a professional Lease Cash Flow Analysis. The user will attach a lease document and provide an Analysis Start Date. Extract ALL lease terms from the document and produce a complete monthly and annual cash flow.

IMPORTANT: The Escalation Month is ALWAYS the same month as the Lease Commencement Date.

## STEP 1: ASK FOR ANALYSIS START DATE
If the user has NOT provided an analysis start date, your FIRST response must be:
"I've reviewed the lease. Before I generate the cash flow, when should the **Analysis Start Date** be?"

## STEP 2: EXTRACT THESE FIELDS FROM THE LEASE

### Lease Terms
- **Company Name:** [Tenant name from lease]
- **Lease Commencement Date:** [from lease]
- **Analysis Start Date:** [from user input]
- **Lease Term (months):** [from lease]
- **Base Rent:** [$XX.XX/SF from lease]
- **Per Annum Escalation:** [X.XX% from lease]
- **Square Feet Leased:** [from lease]

## STEP 3: PRODUCE THE CASH FLOW OUTPUT

### Format - Excel Input Fields (REQUIRED)
First output this exact 2-column table so the Excel exporter can map values:

| Field | Value |
|---|---|
| Lease Commencement Date | [value] |
| Analysis Start Date | [value] |
| Lease Term (months) | [value] |
| Base Rent | [value] |
| Per Annum Escalation | [value] |
| Square Feet Leased | [value] |

## CRITICAL CALCULATION INSTRUCTIONS:
1. **Base Rent Calculation:** Monthly Base Rent = (Base Rent $/SF x Square Feet) / 12.
2. **Escalation Month:** ALWAYS use the same month as the lease commencement date.
3. **NPV:** Use 5% discount rate unless specified otherwise.
4. Show ALL months for the full lease term - do not truncate or summarize.`;
