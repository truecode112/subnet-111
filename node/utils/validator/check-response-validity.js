import logger from '#modules/logger/index.js';

/**
 * Check the validity of a response
 * @param {Array} response - The response to check
 * @param {string} minerUID - The UID of the miner
 * @returns {Object} - The validity of the response
 */
const checkResponseValidity = (response, minerUID) => {
  let isValid = true;
  let validationError;

  // Handle invalid responses
  if (!response || !Array.isArray(response)) {
    logger.error(`UID ${minerUID}: Invalid response - not an array`);
    isValid = false;
    validationError = 'Response is not an array';
  } else if (response.length === 0) {
    logger.error(`UID ${minerUID}: Response is empty`);
    isValid = false;
    validationError = 'Response is empty';
  }

  return { isValid, validationError }
}

export default checkResponseValidity
