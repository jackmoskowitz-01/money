import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateTouchpoints,
  stageLabels,
  stageColors,
  getPipeline,
  savePipeline,
  getOrCreatePipelineItem,
  updatePipelineStage,
  addPipelineNote,
  getOverdueTouchpoints,
  type PipelineItem,
  type PipelineStage,
  type Touchpoint,
} from '@/data/pipelineData';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const makeItem = (overrides: Partial<PipelineItem> = {}): PipelineItem => ({
  tenantId: 'tenant-1',
  buildingId: 'building-1',
  stage: 'meeting_set',
  notes: [],
  lastActivity: new Date().toISOString(),
  ...overrides,
});

describe('generateTouchpoints', () => {
  it('generates touchpoints for meeting_set stage', () => {
    const item = makeItem({ stage: 'meeting_set' });
    const touchpoints = generateTouchpoints(item);

    expect(touchpoints.length).toBeGreaterThanOrEqual(3);
    expect(touchpoints.some(t => t.type === 'market_update')).toBe(true);
    expect(touchpoints.some(t => t.type === 'lease_comp')).toBe(true);
    expect(touchpoints.some(t => t.type === 'check_in')).toBe(true);
  });

  it('generates touchpoints for meeting_held stage', () => {
    const item = makeItem({ stage: 'meeting_held' });
    const touchpoints = generateTouchpoints(item);

    expect(touchpoints.length).toBeGreaterThanOrEqual(3);
    expect(touchpoints.some(t => t.type === 'market_update')).toBe(true);
  });

  it('generates touchpoints for moving_forward stage', () => {
    const item = makeItem({ stage: 'moving_forward' });
    const touchpoints = generateTouchpoints(item);

    expect(touchpoints.some(t => t.type === 'space_available')).toBe(true);
    expect(touchpoints.some(t => t.type === 'intro_colleague')).toBe(true);
    expect(touchpoints.some(t => t.type === 'building_news')).toBe(true);
    // Should also have a generic check_in since moving_forward doesn't add one
    expect(touchpoints.some(t => t.type === 'check_in')).toBe(true);
  });

  it('generates touchpoints for won stage', () => {
    const item = makeItem({ stage: 'won' });
    const touchpoints = generateTouchpoints(item);

    expect(touchpoints.some(t => t.type === 'event_invite')).toBe(true);
    expect(touchpoints.some(t => t.type === 'check_in')).toBe(true);
  });

  it('always includes a check_in touchpoint', () => {
    const stages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];
    for (const stage of stages) {
      const item = makeItem({ stage });
      const touchpoints = generateTouchpoints(item);
      expect(touchpoints.some(t => t.type === 'check_in')).toBe(true);
    }
  });

  it('generates unique touchpoint IDs based on tenant', () => {
    const item = makeItem({ tenantId: 'test-tenant' });
    const touchpoints = generateTouchpoints(item);
    const ids = touchpoints.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids.every(id => id.includes('test-tenant'))).toBe(true);
  });

  it('marks suggested touchpoints appropriately', () => {
    const item = makeItem({ stage: 'meeting_set' });
    const touchpoints = generateTouchpoints(item);
    // Stage-specific touchpoints should be suggested
    const stageSpecific = touchpoints.filter(t => t.type === 'market_update' || t.type === 'lease_comp');
    expect(stageSpecific.every(t => t.suggested)).toBe(true);
  });
});

describe('stageLabels and stageColors', () => {
  const allStages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

  it('has labels for every stage', () => {
    for (const stage of allStages) {
      expect(stageLabels[stage]).toBeDefined();
      expect(typeof stageLabels[stage]).toBe('string');
      expect(stageLabels[stage].length).toBeGreaterThan(0);
    }
  });

  it('has colors for every stage', () => {
    for (const stage of allStages) {
      expect(stageColors[stage]).toBeDefined();
      expect(typeof stageColors[stage]).toBe('string');
    }
  });
});

describe('localStorage pipeline helpers', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns empty array when no pipeline stored', () => {
    expect(getPipeline()).toEqual([]);
  });

  it('saves and retrieves pipeline', () => {
    const items = [makeItem(), makeItem({ tenantId: 'tenant-2' })];
    savePipeline(items);
    const retrieved = getPipeline();
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].tenantId).toBe('tenant-1');
    expect(retrieved[1].tenantId).toBe('tenant-2');
  });

  it('getOrCreatePipelineItem creates new item if not exists', () => {
    const item = getOrCreatePipelineItem('new-tenant', 'new-building');
    expect(item.tenantId).toBe('new-tenant');
    expect(item.buildingId).toBe('new-building');
    expect(item.stage).toBe('meeting_set');
    expect(item.notes).toEqual([]);

    // Should be persisted
    const pipeline = getPipeline();
    expect(pipeline).toHaveLength(1);
  });

  it('getOrCreatePipelineItem returns existing item', () => {
    const items = [makeItem({ stage: 'won' })];
    savePipeline(items);

    const item = getOrCreatePipelineItem('tenant-1', 'building-1');
    expect(item.stage).toBe('won');
  });

  it('updatePipelineStage updates existing item', () => {
    savePipeline([makeItem()]);
    updatePipelineStage('tenant-1', 'building-1', 'moving_forward');

    const pipeline = getPipeline();
    expect(pipeline[0].stage).toBe('moving_forward');
  });

  it('updatePipelineStage creates new item if not exists', () => {
    updatePipelineStage('new-tenant', 'new-building', 'hot_prospect');

    const pipeline = getPipeline();
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0].stage).toBe('hot_prospect');
  });

  it('addPipelineNote adds note to existing item', () => {
    savePipeline([makeItem()]);
    addPipelineNote('tenant-1', 'building-1', 'Test note');

    const pipeline = getPipeline();
    expect(pipeline[0].notes).toContain('Test note');
  });

  it('addPipelineNote creates new item if not exists', () => {
    addPipelineNote('new-tenant', 'new-building', 'First note');

    const pipeline = getPipeline();
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0].notes).toEqual(['First note']);
  });

  it('getOverdueTouchpoints finds overdue items', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const item = makeItem({
      sentTouchpoints: [{
        id: 'tp-1',
        type: 'check_in',
        title: 'Check in',
        description: 'desc',
        suggested: true,
        sentAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        followUpDate: pastDate,
      }],
    });
    savePipeline([item]);

    const overdue = getOverdueTouchpoints();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].touchpoint.id).toBe('tp-1');
  });

  it('getOverdueTouchpoints ignores non-overdue items', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const item = makeItem({
      sentTouchpoints: [{
        id: 'tp-1',
        type: 'check_in',
        title: 'Check in',
        description: 'desc',
        suggested: true,
        sentAt: new Date().toISOString(),
        followUpDate: futureDate,
      }],
    });
    savePipeline([item]);

    const overdue = getOverdueTouchpoints();
    expect(overdue).toHaveLength(0);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.setItem('dealflow-pipeline', 'not-json');
    expect(getPipeline()).toEqual([]);
  });
});
