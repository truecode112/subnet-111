import logger from '#modules/logger/index.js';
import responseService from '#modules/response/index.js';
import apify from '#modules/apify/index.js';
import time from '#modules/time/index.js';
import config from '#config';
import retryable from '#modules/retryable/index.js';
import redisClient from './redisClient.js';

const CACHE_TTL = config.MINER.CACHE_TTL || 600;
const CACHE_WAIT_TIMEOUT = config.MINER.CACHE_WAIT_TIMEOUT || 120000; // 120 seconds
const CACHE_POLL_INTERVAL = config.MINER.CACHE_POLL_INTERVAL || 100;
const ALLOW_DEFERRED_RESPONSE = config.MINER.ALLOW_DEFERRED_RESPONSE || false;

const validSortOptions = ['newest', 'relevant', 'highest', 'lowest'];

const output = (fid, count, language, sort, items) => ({
    status: 'success',
    fid,
    parameters: { count, language, sort },
    reviewCount: items.length,
    reviews: items,
    timestamp: time.getCurrentTimestamp(),
});

const validate = ({ fid, sort, language }) => {
    let isValid = true;
    let message = {};

    if (!fid) {
        isValid = false;
        message = {
            error: 'fid is required',
            message: 'Please provide a valid FID (place identifier)',
        };
    } else if (!validSortOptions.includes(sort)) {
        isValid = false;
        message = {
            error: 'Invalid sort parameter',
            message: `Sort must be one of: ${validSortOptions.join(', ')}`,
        };
    } else if (language && !/^[a-z]{2}$/.test(language)) {
        isValid = false;
        message = {
            error: 'Invalid language code',
            message: 'Language must be a valid ISO 639-1 code (e.g., "en", "fr")',
        };
    } else if (!process.env.APIFY_TOKEN) {
        isValid = false;
        message = {
            error: 'Configuration error',
            message: 'APIFY_TOKEN not configured',
        };
    }

    if (!isValid) logger.error(`[Miner] Validation failed: ${JSON.stringify(message)}`);
    return { isValid, message };
};

const waitForCacheResult = async (cacheKey, timeout = CACHE_WAIT_TIMEOUT) => {
    const waitUntil = Date.now() + timeout;
    let delay = CACHE_POLL_INTERVAL;

    while (Date.now() < waitUntil) {
        const result = await redisClient.get(cacheKey);
        if (result && result !== 'waiting') {
            try {
                return JSON.parse(result);
            } catch (e) {
                logger.error(`[Miner] Failed to parse cached JSON:`, e);
                await redisClient.del(cacheKey);
                break;
            }
        }
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 1.5, 5000);
    }

    return null;
};

const execute = async (request, response) => {
    const { fid = '' } = request.params || {};
    const { language = 'en', sort = 'newest' } = request.query || {};
    const count = config.MINER.REVIEW_COUNT;
    const cacheKey = `gmap_reviews:${fid}:${language}:${sort}`;

    logger.info(`[Miner] Incoming request - FID: ${fid}, Language: ${language}, Sort: ${sort}`);

    const { isValid, message } = validate({ fid, sort, language });
    if (!isValid) return responseService.badRequest(response, message);

    try {
        const cached = await redisClient.get(cacheKey);

        if (cached && cached !== 'waiting') {
            logger.info(`[Miner] Returning cached result for FID: ${fid}`);
            const items = JSON.parse(cached);
            return responseService.success(response, output(fid, count, language, sort, items));
        }

        if (cached === 'waiting') {
            logger.info(`[Miner] Waiting for another scrape to finish...`);
            const items = await waitForCacheResult(cacheKey);
            if (items) {
                return responseService.success(response, output(fid, count, language, sort, items));
            }

            logger.info(`[Miner] Timeout waiting for cached result.`);
            return ALLOW_DEFERRED_RESPONSE
                ? responseService.accepted(response, {
                    message: 'Review fetch in progress. Please retry later.',
                    fid, language, sort,
                    timestamp: time.getCurrentTimestamp(),
                })
                : responseService.internalServerError(response, {
                    error: 'Timeout',
                    message: 'Fetching reviews timed out.',
                    timestamp: time.getCurrentTimestamp(),
                });
        }

        // Try to acquire lock
        const lockSet = await redisClient.set(cacheKey, 'waiting', {
            NX: true,
            EX: CACHE_TTL,
        });

        if (!lockSet) {
            logger.info(`[Miner] Lock exists. Waiting for other process...`);
            const items = await waitForCacheResult(cacheKey);
            if (items) {
                return responseService.success(response, output(fid, count, language, sort, items));
            }

            logger.info(`[Miner] Timeout waiting for lock to release.`);
            return ALLOW_DEFERRED_RESPONSE
                ? responseService.accepted(response, {
                    message: 'Review fetch in progress. Please retry later.',
                    fid, language, sort,
                    timestamp: time.getCurrentTimestamp(),
                })
                : responseService.internalServerError(response, {
                    error: 'Timeout',
                    message: 'Fetching reviews timed out.',
                    timestamp: time.getCurrentTimestamp(),
                });
        }

        // Fetch fresh
        logger.info(`[Miner] Lock acquired. Fetching from Apify...`);
        const items = await retryable(async () => {
            return apify.runActorAndGetResults(config.MINER.APIFY_ACTORS.GOOGLE_MAPS_REVIEWS, {
                placeFIDs: [fid],
                maxItems: count,
                language,
                sort,
            });
        }, 10);

        logger.info(`[Miner] Fetched ${items.length} reviews from Apify.`);
        await redisClient.set(cacheKey, JSON.stringify(items), { EX: CACHE_TTL });

        return responseService.success(response, output(fid, count, language, sort, items));

    } catch (error) {
        logger.error(`[Miner] Error during execution:`, error);
        return responseService.internalServerError(response, {
            error: 'Fetch failure',
            message: error.message || 'Unknown error occurred',
            timestamp: time.getCurrentTimestamp(),
        });
    }
};

export default {
    execute,
    validate,
    output,
};
