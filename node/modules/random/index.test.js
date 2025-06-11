import random from './index.js';

describe('modules/random', () => {
  describe('.fromArray()', () => {
    test('should return a random element from the array', () => {
      const result = random.fromArray(['a', 'b', 'c']);

      expect(['a', 'b', 'c']).toContain(result);
    });
  });

  describe('.between()', () => {

    test('should return a random number between the min and max', () => {
      const result = random.between(1, 10);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });
  });
});
