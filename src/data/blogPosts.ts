import coldEmailTemplates from '../../content/blog/commercial-real-estate-cold-email-templates.md?raw';
import leavingDeals from '../../content/blog/tenant-rep-brokers-leaving-deals-on-table.md?raw';
import prospectingPlaybook from '../../content/blog/tenant-rep-prospecting-playbook.md?raw';
import leaseExpiration from '../../content/blog/lease-expiration-prospecting-strategy.md?raw';
import aiChanging from '../../content/blog/ai-changing-cre-broker-prospecting.md?raw';
import outreachAutomation from '../../content/blog/cre-outreach-automation-personal-touch.md?raw';
import weeklyRoutine from '../../content/blog/cre-broker-weekly-outreach-routine.md?raw';
import decisionMakers from '../../content/blog/finding-decision-makers-cre-tenant-rep.md?raw';
import linkedinSalesNav from '../../content/blog/linkedin-sales-navigator-commercial-real-estate.md?raw';
import followUpSequences from '../../content/blog/cre-follow-up-sequences-that-work.md?raw';
import bookOfBusiness from '../../content/blog/build-book-of-business-cre-broker.md?raw';
import coldCallVsEmail from '../../content/blog/cold-call-vs-cold-email-cre.md?raw';

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  if (match) {
    return raw.slice(match[0].length).trim();
  }
  return raw.trim();
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  keywords?: string[];
  author: string;
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'commercial-real-estate-cold-email-templates',
    title: 'Commercial Real Estate Cold Email Templates That Actually Get Responses',
    description:
      '7 proven cold email templates for tenant rep brokers, with real scenarios, personalization tips, and deliverability advice to help you fill your pipeline.',
    date: '2026-03-23',
    category: 'Prospecting',
    author: 'Money Team',
    content: stripFrontmatter(coldEmailTemplates),
  },
  {
    slug: 'tenant-rep-brokers-leaving-deals-on-table',
    title: 'Why Tenant Rep Brokers Are Leaving Deals on the Table',
    description:
      'The average tenant rep broker reaches less than 5% of their addressable market. Here\'s the math on why — and what the top producers are doing differently.',
    date: '2026-03-23',
    category: 'Tenant Representation',
    author: 'The Money Team',
    content: stripFrontmatter(leavingDeals),
  },
  {
    slug: 'tenant-rep-prospecting-playbook',
    title: "The Tenant Rep Broker's Prospecting Playbook: A Complete Guide",
    description:
      'The most comprehensive guide to tenant rep prospecting on the internet. Covers targeting, research, outreach cadences, follow-up systems, and scaling with AI.',
    date: '2026-03-23',
    category: 'Prospecting',
    author: 'Money Team',
    content: stripFrontmatter(prospectingPlaybook),
  },
  {
    slug: 'lease-expiration-prospecting-strategy',
    title: 'Lease Expiration Prospecting: The Complete Strategy for Tenant Rep Brokers',
    description:
      'A step-by-step guide to building a lease expiration prospecting pipeline, from finding data sources to crafting outreach sequences.',
    date: '2026-03-23',
    category: 'Prospecting',
    author: 'Money',
    content: stripFrontmatter(leaseExpiration),
  },
  {
    slug: 'ai-changing-cre-broker-prospecting',
    title: 'How AI Is Changing CRE Broker Prospecting (And What to Do About It)',
    description:
      "AI isn't replacing CRE brokers — it's giving the best ones an unfair advantage. Here's what's actually changing in commercial real estate prospecting.",
    date: '2026-03-23',
    category: 'AI & CRE Strategy',
    author: 'The LeaseUp Team',
    content: stripFrontmatter(aiChanging),
  },
  {
    slug: 'cre-outreach-automation-personal-touch',
    title: 'CRE Outreach Automation Without Losing the Personal Touch',
    description:
      'How to automate your CRE prospecting workflow without sounding like spam. The rule: automate the work, keep the relationship manual.',
    date: '2026-03-23',
    category: 'Outreach',
    author: 'Money Team',
    content: stripFrontmatter(outreachAutomation),
  },
  {
    slug: 'cre-broker-weekly-outreach-routine',
    title: "The CRE Broker's Weekly Outreach Routine: A Hour-by-Hour Breakdown",
    description:
      'A practical, copy-this-tomorrow weekly prospecting routine for tenant rep brokers. Monday through Friday, hour by hour.',
    date: '2026-03-23',
    category: 'Prospecting',
    author: 'DealFlow Team',
    content: stripFrontmatter(weeklyRoutine),
  },
  {
    slug: 'finding-decision-makers-cre-tenant-rep',
    title: 'Finding the Decision-Maker: Who to Contact for CRE Tenant Rep Deals',
    description:
      "The #1 wasted effort in broker prospecting is emailing the wrong person. Here's how to find and reach the actual decision-maker by company size.",
    date: '2026-03-23',
    category: 'Prospecting',
    author: 'DealFlow Team',
    content: stripFrontmatter(decisionMakers),
  },
  {
    slug: 'linkedin-sales-navigator-commercial-real-estate',
    title: 'How to Use LinkedIn Sales Navigator for Commercial Real Estate Prospecting',
    description:
      "The only CRE-specific guide to LinkedIn Sales Navigator. From saved searches to InMail templates, here's how to turn LinkedIn into a prospecting machine.",
    date: '2026-03-23',
    category: 'Outreach',
    author: 'DealFlow Team',
    content: stripFrontmatter(linkedinSalesNav),
  },
  {
    slug: 'cre-follow-up-sequences-that-work',
    title: "Follow-Up Sequences That Don't Annoy: A CRE Broker's Guide",
    description:
      'The line between persistent and annoying is thinner than you think. Here\'s a 5-touch follow-up sequence with templates that add value every time.',
    date: '2026-03-23',
    category: 'Outreach',
    author: 'DealFlow Team',
    content: stripFrontmatter(followUpSequences),
  },
  {
    slug: 'build-book-of-business-cre-broker',
    title: 'How to Build a Book of Business as a CRE Broker (Even Starting from Zero)',
    description:
      'The honest playbook for building a CRE brokerage career from scratch. From your first 100-company list to scaling past the $500K GCI plateau.',
    date: '2026-03-23',
    category: 'Career Growth',
    author: 'DealFlow Team',
    content: stripFrontmatter(bookOfBusiness),
  },
  {
    slug: 'cold-call-vs-cold-email-cre',
    title: 'Cold Call vs. Cold Email for CRE Brokers: What Actually Works in 2026',
    description:
      'The eternal debate, settled with data. Both work — but the hybrid approach is 3x more effective than either alone.',
    date: '2026-03-23',
    category: 'Outreach',
    author: 'DealFlow Team',
    content: stripFrontmatter(coldCallVsEmail),
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
