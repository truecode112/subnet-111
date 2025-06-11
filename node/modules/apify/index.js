import { ApifyClient } from 'apify-client';
import logger from '#modules/logger/index.js';

/**
 * Run any Apify actor and get the results
 * First it calls the actor with the parameters
 * Then it gets the results from the dataset
 *
 * @example
 * const results = await runActorAndGetResults('agents/google-maps-reviews', {
 *   placeFIDs: ['1234567890'],
 *   maxItems: 10,
 *   language: 'en',
 *   sort: 'newest'
 * });
 *
 * @param {string} actorId - The ID of the actor to run
 * @param {Object} parameters - The parameters to pass to the actor
 * @returns {Promise<Object>} - The results of the actor run
 */
async function runActorAndGetResults(actorId, parameters) {
  // Initialize Apify client
  const apifyClient = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  });

  // Run the Google Reviews actor with specified parameters
  const run = await apifyClient.actor(actorId).call(parameters);

  // Get the scraped results from Apify dataset
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  // TODO: This prints as [Miner] when validator spot checks, so removed.
  logger.info(`Successfully fetched ${items.length} reviews`);

  return items;
}

export default {
  runActorAndGetResults
};
