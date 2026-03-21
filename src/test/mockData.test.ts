import { describe, it, expect } from 'vitest';
import { buildings, newsItems, type Building, type Tenant } from '@/data/mockData';

describe('mockData buildings', () => {
  it('has buildings with required fields', () => {
    expect(buildings.length).toBeGreaterThan(0);
    for (const building of buildings) {
      expect(building.id).toBeDefined();
      expect(building.name).toBeDefined();
      expect(building.address).toBeDefined();
      expect(typeof building.lat).toBe('number');
      expect(typeof building.lng).toBe('number');
      expect(typeof building.sqft).toBe('number');
      expect(typeof building.floors).toBe('number');
      expect(['A', 'B', 'C']).toContain(building.class);
    }
  });

  it('has unique building IDs', () => {
    const ids = buildings.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each building has tenants', () => {
    for (const building of buildings) {
      expect(Array.isArray(building.tenants)).toBe(true);
      expect(building.tenants.length).toBeGreaterThan(0);
    }
  });

  it('tenants have required fields', () => {
    for (const building of buildings) {
      for (const tenant of building.tenants) {
        expect(tenant.id).toBeDefined();
        expect(tenant.name).toBeDefined();
        expect(tenant.industry).toBeDefined();
        expect(typeof tenant.sqft).toBe('number');
        expect(tenant.floor).toBeDefined();
        expect(tenant.leaseExpiration).toBeDefined();
        expect(tenant.contactName).toBeDefined();
        expect(tenant.contactEmail).toBeDefined();
        expect(typeof tenant.headcount).toBe('number');
      }
    }
  });

  it('tenant IDs are unique across all buildings', () => {
    const allTenantIds = buildings.flatMap(b => b.tenants.map(t => t.id));
    expect(new Set(allTenantIds).size).toBe(allTenantIds.length);
  });

  it('tenants have valid outreach reasons', () => {
    const validTypes = ['lease_expiration', 'vacancy', 'market_news', 'building_sale', 'expansion', 'contraction'];
    const validUrgency = ['high', 'medium', 'low'];

    for (const building of buildings) {
      for (const tenant of building.tenants) {
        for (const reason of tenant.outreachReasons) {
          expect(validTypes).toContain(reason.type);
          expect(validUrgency).toContain(reason.urgency);
          expect(reason.title).toBeDefined();
          expect(reason.description).toBeDefined();
        }
      }
    }
  });
});

describe('mockData newsItems', () => {
  it('is a valid array (may be empty if news is fetched dynamically)', () => {
    expect(Array.isArray(newsItems)).toBe(true);
  });

  it('items have valid structure when present', () => {
    for (const news of newsItems) {
      expect(news.id).toBeDefined();
      expect(news.title).toBeDefined();
      expect(news.summary).toBeDefined();
      expect(news.source).toBeDefined();
      expect(news.date).toBeDefined();
      expect(['lease', 'sale', 'expansion', 'market', 'vacancy', 'contraction']).toContain(news.category);
    }
  });
});
