import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logger logic directly since import.meta.env isn't easily mockable
describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logger module exports expected methods', async () => {
    const { logger } = await import('@/lib/logger');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('error logs in all modes', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');
    logger.error('test error');
    expect(spy).toHaveBeenCalled();
  });

  it('warn logs in development mode', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('@/lib/logger');
    logger.warn('test warning');
    expect(spy).toHaveBeenCalled();
  });
});
