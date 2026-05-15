import { describe, expect, it } from 'vitest';
import { logger } from '../../src/server/utils/logger';

describe('runtime logger', () => {
  it('keeps only the latest 20 errors and redacts sensitive context', () => {
    logger.clearRecentErrors();
    for (let index = 0; index < 25; index += 1) {
      logger.error(`error-${index}`, { password: 'secret', cookie: 'abc', safe: index });
    }

    const errors = logger.recentErrors();
    expect(errors).toHaveLength(20);
    expect(errors[0].message).toBe('error-5');
    expect(errors.at(-1)?.message).toBe('error-24');
    expect(errors.at(-1)?.context).toMatchObject({
      password: '[redacted]',
      cookie: '[redacted]',
      safe: 24,
    });
  });
});
