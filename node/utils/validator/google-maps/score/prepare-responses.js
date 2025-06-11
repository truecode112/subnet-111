import logger from '#modules/logger/index.js';
import config from '#config';
import checkResponseValidity from '#utils/validator/check-response-validity.js';
import generateValidationData from '#utils/validator/validation-data.js';
import array from '#modules/array/index.js';

/**
 * Selects a subset of reviews for spot checking, including the most recent review and random samples.
 * The function ensures that the most recent review is always included in the selection, and the remaining
 * reviews are randomly selected from the rest of the available reviews.
 *
 * @param {Array<Object>} reviews - Array of review objects to select from
 * @param {string} reviews[].reviewId - Unique identifier for each review
 * @param {string} reviews[].publishedAtDate - ISO date string of when the review was published
 * @param {string} fid - Facility ID associated with the reviews
 * @param {string|number} minerUID - Unique identifier for the miner, used for logging purposes
 *
 * @returns {Object} An object containing the selected reviews and most recent date
 * @returns {Date|undefined} .mostRecentDate - Date object of the most recent review, or undefined if no reviews
 * @returns {Array<Object>} .selectedReviews - Array of selected review objects for spot checking
 *                                             Contains at most config.VALIDATOR.SPOT_CHECK_COUNT reviews,
 *                                             always including the most recent review if available
 *
 * @example
 * const result = getReviewsForSpotCheck([
 *   { reviewId: '1', publishedAtDate: '2024-03-20' },
 *   { reviewId: '2', publishedAtDate: '2024-03-19' }
 * ], 'facility123', 'miner456');
 * // Returns { mostRecentDate: Date('2024-03-20'), selectedReviews: [...] }
 */
const getReviewsForSpotCheck = (reviews, fid, minerUID) => {
  // Early return if no reviews
  if (!reviews?.length) {
    return {
      mostRecentDate: undefined,
      selectedReviews: []
    }
  };

  // Early return if no spot check count
  const spotCheckCount = Math.min(config.VALIDATOR.SPOT_CHECK_COUNT, reviews.length);
  if (spotCheckCount === 0) {
    return {
      mostRecentDate: undefined,
      selectedReviews: []
    }
  };

  // Find most recent review
  let mostRecentReview;
  let mostRecentDate;
  for (const review of reviews) {
    const reviewDate = new Date(review.publishedAtDate);
    if (!mostRecentDate || reviewDate > mostRecentDate) {
      mostRecentDate = reviewDate;
      mostRecentReview = review;
    }
  }

  // Log the most recent review selection
  logger.info(
    `UID ${minerUID}: Selected most recent review ${mostRecentReview.reviewId} - (${mostRecentReview.publishedAtDate}) for spot check`
  );

  // If we only need one review, return just the most recent
  if (spotCheckCount === 1) {
    return {
      mostRecentDate,
      selectedReviews: [mostRecentReview]
    };
  }

  // Get remaining reviews excluding the most recent one
  const remainingReviews = reviews.filter(review => review.reviewId !== mostRecentReview.reviewId);

  // Select random reviews with the number of spot check count - 1
  const randomReviews = remainingReviews
    .sort(() => Math.random() - 0.5)  // Fisher-Yates shuffle in place
    .slice(0, spotCheckCount - 1);

  // Log random selections for spot check
  for (const review of randomReviews) {
    logger.info(
      `UID ${minerUID}: Selected random review ${review.reviewId} - (${review.publishedAtDate}) for spot check`
    );
  }

  return {
    mostRecentDate,
    selectedReviews: [mostRecentReview, ...randomReviews]
  }
};

/**
 * Processes and validates an array of Google Maps review responses, performing data cleaning,
 * structural validation, and selecting reviews for spot checking.
 *
 * @param {Array<Array<Object>>} responses - Array of response arrays from different miners, where each response
 *                                          contains review objects
 * @param {Array<string|number>} minerUIDs - Array of miner unique identifiers corresponding to each response
 * @param {string} fid - Facility ID that should match across all reviews
 *
 * @returns {Object} An object containing validation results and selected reviews for spot checking
 * @returns {Array<Object>} .validationData - Array of validation results for each miner
 * @returns {Array<Object>} .validationData[].minerUID - The miner's unique identifier
 * @returns {boolean} .validationData[].passedValidation - Whether the miner's response passed all validations
 * @returns {string} [.validationData[].validationError] - Error message if validation failed
 * @returns {number} [.validationData[].count] - Number of valid reviews if validation passed
 * @returns {Date} [.validationData[].mostRecentDate] - Date of the most recent review if validation passed
 * @returns {Array<Object>} [.validationData[].data] - Selected reviews for spot checking if validation passed
 * @returns {Array<Object>} .allSpotCheckReviews - Array of selected reviews grouped by miner for spot checking
 * @returns {string|number} .allSpotCheckReviews[].minerUID - The miner's unique identifier
 * @returns {Array<Object>} .allSpotCheckReviews[].reviews - Array of selected reviews for spot checking
 *
 * @example
 * const responses = [
 *   [
 *     {
 *       reviewerId: '123',
 *       reviewerUrl: 'https://...',
 *       reviewerName: 'John Doe',
 *       reviewId: 'rev123',
 *       reviewUrl: 'https://...',
 *       publishedAtDate: '2024-03-20',
 *       placeId: 'place123',
 *       cid: 'cid123',
 *       fid: 'facility123',
 *       totalScore: 5
 *     }
 *   ]
 * ];
 * const minerUIDs = ['miner1'];
 * const fid = 'facility123';
 *
 * const result = prepareResponses(responses, minerUIDs, fid);
 * // Returns {
 * //   validationData: [{
 * //     minerUID: 'miner1',
 * //     passedValidation: true,
 * //     count: 1,
 * //     mostRecentDate: Date('2024-03-20'),
 * //     data: [...]
 * //   }],
 * //   allSpotCheckReviews: [{
 * //     minerUID: 'miner1',
 * //     reviews: [...]
 * //   }]
 * // }
 */
const prepareResponses = (responses, minerUIDs, fid) => {
  const validationData = [];
  const allSpotCheckReviews = [];

  for (const [index, response] of responses.entries()) {
    const minerUID = minerUIDs[index] || index;

    // Check if the response object is valid
    const { isValid, validationError } = checkResponseValidity(response, minerUID);
    if (!isValid) {
      validationData.push({
        ...generateValidationData({ minerUID }),
        validationError
      });
      continue;
    }

    // Data Cleaning - Remove duplicate reviews by reviewId
    const uniqueReviews = array.uniqueBy(response, 'reviewId');
    logger.info(`UID ${minerUID}: Data cleaning - ${response.length} reviews -> ${uniqueReviews.length} unique reviews`);

    // Structural Validation - Check required fields and types
    const requiredFields = [
      { name: 'reviewerId', type: 'string' },
      { name: 'reviewerUrl', type: 'string' },
      { name: 'reviewerName', type: 'string' },
      { name: 'reviewId', type: 'string' },
      { name: 'reviewUrl', type: 'string' },
      { name: 'publishedAtDate', type: 'string' },
      { name: 'placeId', type: 'string' },
      { name: 'cid', type: 'string' },
      { name: 'fid', type: 'string' },
      { name: 'totalScore', type: 'number' },
      { name: 'fid', type: 'string', validate: (value) => value === fid }
    ];

    // Validate the reviews
    const { valid: validReviews, invalid } = array.validateArray(uniqueReviews, requiredFields);

    // If there are invalid reviews, add them to the miner validation data
    if (invalid.length > 0) {
      validationData.push({
        ...generateValidationData({ minerUID }),
        validationError: 'Structural validation failed on review objects',
      });
      continue;
    }

    logger.info(`UID ${minerUID}: Structural validation passed - ${validReviews.length} reviews validated successfully`);

    // Calculate metrics for this miner
    const count = validReviews.length;

    const { mostRecentDate, selectedReviews } = getReviewsForSpotCheck(validReviews, fid, minerUID);

    // Store validation data and selected reviews for batch processing
    validationData.push(
      generateValidationData({
        minerUID,
        count,
        mostRecentDate,
        data: selectedReviews,
        passedValidation: true
      })
    );

    // Add to batch spot check if we have selected reviews
    if (selectedReviews.length > 0) {
      allSpotCheckReviews.push({
        minerUID,
        reviews: selectedReviews
      });
    }
  }

  return {
    validationData,
    allSpotCheckReviews
  }
}

export {
  prepareResponses,
  getReviewsForSpotCheck
}
