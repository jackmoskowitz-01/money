export type EmailTemplateCategory = 'cold_outreach' | 'follow_up' | 'tour_confirmation' | 'check_in' | 'market_update';

export type EmailTemplate = {
  id: string;
  category: EmailTemplateCategory;
  name: string;
  subject: string;
  body: string;
  description: string;
};

export const categoryLabels: Record<EmailTemplateCategory, string> = {
  cold_outreach: 'Cold Outreach',
  follow_up: 'Follow-Up',
  tour_confirmation: 'Tour Confirmation',
  check_in: 'Check-In',
  market_update: 'Market Update',
};

export const categoryColors: Record<EmailTemplateCategory, string> = {
  cold_outreach: 'bg-primary/10 text-primary',
  follow_up: 'bg-warning/10 text-warning',
  tour_confirmation: 'bg-success/10 text-success',
  check_in: 'bg-info/10 text-info',
  market_update: 'bg-accent text-accent-foreground',
};

/** Merge placeholders like {{contactFirstName}}, {{tenantName}}, etc. */
export const fillTemplate = (
  template: string,
  vars: Record<string, string>
): string => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};

export const emailTemplates: EmailTemplate[] = [
  // ── Cold Outreach ──
  {
    id: 'cold-intro',
    category: 'cold_outreach',
    name: 'Introduction',
    description: 'First-touch intro positioning yourself as a market resource',
    subject: '{{tenantName}} — Quick Introduction',
    body: `Hi {{contactFirstName}},

I'm reaching out because I cover the {{submarket}} office market and noticed {{tenantName}} at {{buildingName}}. I help tenants like yours evaluate their options well ahead of lease decisions — whether that's renegotiating in place, exploring new space, or simply staying informed on what's happening in the market.

No pitch here — just wanted to introduce myself as a resource. Would you be open to a brief call this week?

Best,
{{brokerName}}`,
  },
  {
    id: 'cold-lease-expiry',
    category: 'cold_outreach',
    name: 'Lease Expiration',
    description: 'Outreach tied to an upcoming lease expiration date',
    subject: '{{tenantName}} — Lease Expiration Planning',
    body: `Hi {{contactFirstName}},

I see that {{tenantName}}'s lease at {{buildingName}} is coming up in {{leaseExpiration}}. In the current market, tenants who start evaluating options 12–18 months out consistently get better terms — landlords are competing aggressively for quality tenants.

I'd love to share a quick overview of what's available in {{submarket}} and how recent deals have been structured. Worth a 15-minute conversation?

Best,
{{brokerName}}`,
  },
  {
    id: 'cold-market-conditions',
    category: 'cold_outreach',
    name: 'Market Conditions',
    description: 'Lead with favorable market conditions to create urgency',
    subject: 'Tenant-Favorable Market in {{submarket}}',
    body: `Hi {{contactFirstName}},

The {{submarket}} market is as tenant-favorable as I've seen it — vacancy is elevated, concession packages are aggressive, and landlords are offering terms that would have been unheard of two years ago.

For {{tenantName}}, this could mean significant savings or a major upgrade in space quality. I put together a brief market snapshot that might be useful. Happy to send it over or walk through it on a call.

Best,
{{brokerName}}`,
  },

  // ── Follow-Up ──
  {
    id: 'followup-after-call',
    category: 'follow_up',
    name: 'After Call',
    description: 'Follow-up after an initial phone conversation',
    subject: 'Great Speaking With You, {{contactFirstName}}',
    body: `Hi {{contactFirstName}},

Thanks for taking the time to chat today. As discussed, I'll put together a short list of options in {{submarket}} that align with what {{tenantName}} is looking for — specifically around {{sqft}} SF with the flexibility and amenities you mentioned.

I'll have something over to you by end of week. In the meantime, don't hesitate to reach out with any questions.

Best,
{{brokerName}}`,
  },
  {
    id: 'followup-no-response',
    category: 'follow_up',
    name: 'No Response',
    description: 'Gentle nudge after no reply to previous outreach',
    subject: 'Following Up — {{tenantName}}',
    body: `Hi {{contactFirstName}},

Just wanted to circle back on my earlier note. I know things get busy, so I'll keep this short — I've been tracking the {{submarket}} market closely and have some data points that could be relevant as {{tenantName}} thinks about its space strategy.

Happy to share whenever the timing is right. No pressure at all.

Best,
{{brokerName}}`,
  },
  {
    id: 'followup-after-tour',
    category: 'follow_up',
    name: 'After Tour',
    description: 'Follow-up after a building tour',
    subject: 'Tour Recap — {{buildingName}}',
    body: `Hi {{contactFirstName}},

Thanks for taking the time to tour {{buildingName}} today. Here are my initial thoughts:

• The space on {{floor}} offers great natural light and a flexible layout
• Building amenities align well with what you described for {{tenantName}}
• The landlord has indicated they're motivated — I think there's room to negotiate favorable terms

I'll follow up with a formal proposal and comp data so we can evaluate this option alongside the others. Let me know if you have any initial reactions.

Best,
{{brokerName}}`,
  },

  // ── Tour Confirmation ──
  {
    id: 'tour-confirm',
    category: 'tour_confirmation',
    name: 'Tour Confirmation',
    description: 'Confirm an upcoming building tour with details',
    subject: 'Tour Confirmed — {{buildingName}}',
    body: `Hi {{contactFirstName}},

Just confirming our tour of {{buildingName}} on {{tourDate}} at {{tourTime}}.

Details:
• Building: {{buildingName}}
• Address: {{buildingAddress}}
• Meet: Main lobby — I'll be there to greet you
• Duration: Approximately 30–45 minutes

We'll be looking at available suites on {{floor}} that could work for {{tenantName}}. Please let me know if you need to adjust the time or if anyone else from your team will be joining.

Looking forward to it!

Best,
{{brokerName}}`,
  },
  {
    id: 'tour-reschedule',
    category: 'tour_confirmation',
    name: 'Reschedule Tour',
    description: 'Request to reschedule a planned tour',
    subject: 'Reschedule — {{buildingName}} Tour',
    body: `Hi {{contactFirstName}},

I wanted to reach out about our upcoming tour of {{buildingName}}. Unfortunately, I need to reschedule — would any of the following times work for you?

• [Option 1]
• [Option 2]
• [Option 3]

Apologies for the change, and I'll make sure we get this locked in at a time that works best for you and the {{tenantName}} team.

Best,
{{brokerName}}`,
  },

  // ── Check-In ──
  {
    id: 'checkin-quarterly',
    category: 'check_in',
    name: 'Quarterly Check-In',
    description: 'Periodic touchpoint to stay top of mind',
    subject: 'Quick Check-In — {{tenantName}}',
    body: `Hi {{contactFirstName}},

Hope things are going well at {{tenantName}}. Just wanted to touch base and see how the space at {{buildingName}} is working for your team.

A few quick market updates that might be relevant:
• {{submarket}} vacancy has shifted — happy to share the latest data
• Several new amenity-rich options have come to market
• Concession packages are still historically strong

If anything has changed on your end — growth plans, space concerns, lease questions — I'm always happy to chat. No agenda, just staying in touch.

Best,
{{brokerName}}`,
  },

  // ── Market Update ──
  {
    id: 'market-update',
    category: 'market_update',
    name: 'Market Snapshot',
    description: 'Share a curated market update to add value',
    subject: '{{submarket}} Market Update — Q1 2025',
    body: `Hi {{contactFirstName}},

Wanted to share a quick snapshot of what's happening in the {{submarket}} office market:

📊 Key Metrics:
• Vacancy: Trending at [X]%, up from [Y]% last quarter
• Net Absorption: [negative/positive] — [X] SF
• Avg Asking Rent: $[X]/SF, down [Y]% YoY
• Concessions: Free rent averaging [X] months on new deals

🔍 What This Means for {{tenantName}}:
The market continues to favor tenants. If {{tenantName}} is considering any changes to its footprint — expansion, contraction, relocation, or renegotiation — now is an excellent time to explore options.

Happy to walk through any of this in more detail.

Best,
{{brokerName}}`,
  },
];
