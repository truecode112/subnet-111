import reviewsRoute from './reviews.js';
import responseService from '#modules/response/index.js';
import apify from '#modules/apify/index.js';
import retryable from '#modules/retryable/index.js';
import config from '#config';

jest.mock('#modules/logger/index.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('#modules/time/index.js', () => ({
  getCurrentTimestamp: jest.fn().mockReturnValue("2025-01-01 00:00:00"),
}));

jest.mock('#modules/response/index.js', () => ({
  success: jest.fn(),
  badRequest: jest.fn(),
  internalServerError: jest.fn(),
}));

jest.mock('#modules/retryable/index.js');
jest.mock('#modules/apify/index.js');

describe('routes/miner/google-maps/reviews.js', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.APIFY_TOKEN = 'test';
  });

  describe('.output()', () => {
    test('should output the result properly', () => {
      const result = reviewsRoute.output('1234567890', 10, 'en', 'newest', []);
      expect(result).toEqual({
        status: 'success',
        fid: '1234567890',
        parameters: {
          count: 10,
          language: 'en',
          sort: 'newest'
        },
        reviewCount: 0,
        reviews: [],
        timestamp: expect.any(String),
      });
    });
  });

  describe('.validate()', () => {
    test('should fail if fid is missing', () => {
      const result = reviewsRoute.validate({});
      expect(result).toEqual({
        isValid: false,
        message: {
          error: 'fid is required',
          message: 'Please provide a valid FID (place identifier)'
        }
      });
    });

    test('should fail if sort is invalid', () => {
      const result = reviewsRoute.validate({ fid: '1234567890', sort: 'invalid' });
      expect(result).toEqual({
        isValid: false,
        message: {
          error: 'Invalid sort parameter',
          message: 'Sort must be one of: newest, relevant, highest, lowest'
        }
      });
    });

    test('should fail if APIFY_TOKEN is not configured', () => {
      delete process.env.APIFY_TOKEN;
      const result = reviewsRoute.validate({ fid: '1234567890', sort: 'newest' });
      expect(result).toEqual({
        isValid: false,
        message: {
          error: 'Configuration error',
          message: 'APIFY_TOKEN not configured'
        }
      });
    });

    test('should pass if all parameters are valid', () => {
      const result = reviewsRoute.validate({ fid: '1234567890', sort: 'newest' });
      expect(result).toEqual({
        isValid: true,
        message: {}
      });
    });
  });

  describe('.execute()', () => {
    let response;
    let request;
    let items;

    beforeEach(() => {
      response = {
        status: jest.fn(),
        json: jest.fn(),
      };
      request = {
        params: {
          fid: '1234567890',
        },
        query: {
          language: 'en',
          sort: 'newest',
        },
      };
      items = Array.from({ length: config.MINER.REVIEW_COUNT }, (_, index) => ({
        id: index + 1,
        text: `Review ${index + 1}`
      }));
      retryable.mockImplementation((function_) => function_());
      apify.runActorAndGetResults.mockResolvedValue(items);
    });

    test('should fail if validate() fails', async () => {
      request.params.fid = undefined;
      request.query = {}
      await reviewsRoute.execute(request, response);
      expect(responseService.badRequest).toHaveBeenCalledWith(response, {
        error: 'fid is required',
        message: 'Please provide a valid FID (place identifier)'
      });
    });

    test('should fail if apify.runActorAndGetResults() fails', async () => {
      retryable.mockImplementation(() => {
        throw new Error('Failed to fetch reviews');
      });
      apify.runActorAndGetResults.mockRejectedValue(new Error('Failed to fetch reviews'));
      await reviewsRoute.execute(request, response);
      expect(responseService.internalServerError).toHaveBeenCalledWith(response, {
        error: 'Failed to fetch reviews',
        message: 'Failed to fetch reviews',
        timestamp: expect.any(String),
      });
    });

    test('should return response properly', async () => {
      await reviewsRoute.execute(request, response);
      expect(apify.runActorAndGetResults).toHaveBeenCalledWith(config.MINER.APIFY_ACTORS.GOOGLE_MAPS_REVIEWS, {
        placeFIDs: ['1234567890'],
        maxItems: expect.any(Number),
        language: 'en',
        sort: 'newest'
      });
      expect(responseService.success).toHaveBeenCalledWith(response, {
        status: 'success',
        fid: '1234567890',
        parameters: {
          count: 100,
          language: 'en',
          sort: 'newest'
        },
        reviewCount: 100,
        reviews: items,
        timestamp: "2025-01-01 00:00:00"
      });
    });
  });
});
