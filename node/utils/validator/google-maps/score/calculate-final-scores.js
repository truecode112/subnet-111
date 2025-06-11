import logger from '#modules/logger/index.js';
import time from '#modules/time/index.js';
import generateValidationData from '#utils/validator/validation-data.js';

/**
 * Calculate final scores using the new three-component scoring system:
 * - Speed Score (30%): Based on response time
 * - Volume Score (50%): Based on number of reviews returned
 * - Recency Score (20%): Based on most recent review date
 *
 * @param {Array} validationData - Array of validation data with metrics
 * @param {number} synapseTimeout - The synapse timeout value in seconds
 * @returns {Array} Final scores for each miner
 */
const calculateFinalScores = (validationData, responseTimes, synapseTimeout = 120) => {
  // Update the scoring results with the response time
  const scoringResults = validationData.map((minerData, index) => ({
    ...minerData,
    responseTime: responseTimes[index] || synapseTimeout,
  }));

  // Calculate minimums and maximums for normalization
  const validResults = scoringResults.filter(response =>
    response.passedValidation && response.responseTime < synapseTimeout
  );

  // If no valid results, return the scoring results with 0 scores
  if (validResults.length === 0) {
    logger.warning('No valid results to score');
    const finalScores = scoringResults.map((result, index) => ({
      ...generateValidationData({
        minerUID: result.minerUID,
        minerIndex: index,
      }),
      score: 0,
      components: {
        speedScore: 0,
        volumeScore: 0,
        recencyScore: 0
      },
      passedValidation: false,
      validationError: result.validationError || 'No valid responses',
      responseTime: result.responseTime,
      count: 0
    }));

    const scores = finalScores.map(result => result.score);
    return {
      scores,
      meanScore: 0,
      minScore: 0,
      maxScore: 0,
      finalScores
    };
  }

  // Calculate the response times, counts, and most recent dates
  const validResponseTimes = validResults.map(response => response.responseTime);
  const validCounts = validResults.map(response => response.count);
  const validRecentDates = validResults
    .map(response => response.mostRecentDate)
    .filter(date => date !== undefined);

  // Calculate min/max values for normalization
  const Tmin = Math.min(...validResponseTimes);
  const Vmax = Math.max(...validCounts);
  const mostRecentDateOverall = time.getMostRecentDate(validRecentDates);
  const oldestDateOverall = time.getOldestDate(validRecentDates);
  const dateRange = mostRecentDateOverall && oldestDateOverall ?
    (mostRecentDateOverall.getTime() - oldestDateOverall.getTime()) : 0;

  logger.info(`Scoring parameters - Tmin: ${Tmin.toFixed(2)}s, Vmax: ${Vmax} reviews, Date range: ${dateRange / (1000 * 60 * 60 * 24)} days`);

  const finalScores = scoringResults.map((result, index) => {
    const { passedValidation, count, mostRecentDate, responseTime, minerUID } = result;

    // Reject if validation fails or response time >= synapseTimeout
    if (!passedValidation || responseTime >= synapseTimeout) {
      return {
        minerUID,
        minerIndex: index,
        score: 0,
        components: {
          speedScore: 0,
          volumeScore: 0,
          recencyScore: 0
        },
        passedValidation: false,
        validationError: result.validationError || (responseTime >= synapseTimeout ? `Response timeout (>= ${synapseTimeout}s)` : 'Unknown error'),
        responseTime,
        count: count || 0
      };
    }

    // Speed score (30%) - faster responses get higher scores
     /* istanbul ignore next */
    const speedScore = responseTime > 0 ? Tmin / responseTime : 0;

    // Volume score (50%) - more reviews get higher scores
    const volumeScore = Vmax > 0 ? count / Vmax : 0;

    // Recency score (20%) - more recent reviews get higher scores
    let recencyScore = 0;
    if (mostRecentDate && dateRange > 0) {
      const dateScore = (mostRecentDate.getTime() - oldestDateOverall.getTime()) / dateRange;
      recencyScore = dateScore;
    } else if (mostRecentDate && dateRange === 0) {
      // All miners have same date, give full score
      recencyScore = 1;
    }

    // Final score is weighted average of all components
    const finalScore = (0.3 * speedScore) + (0.5 * volumeScore) + (0.2 * recencyScore);

    logger.info(`Miner ${minerUID} Final Score: ${finalScore.toFixed(4)} - Speed: ${speedScore.toFixed(4)} (${responseTime.toFixed(2)}s), Volume: ${volumeScore.toFixed(4)} (${count} reviews), Recency: ${recencyScore.toFixed(4)}`);

    return {
      minerUID,
      minerIndex: index,
      score: Number.parseFloat(finalScore.toFixed(4)),
      components: {
        speedScore: Number.parseFloat(speedScore.toFixed(4)),
        volumeScore: Number.parseFloat(volumeScore.toFixed(4)),
        recencyScore: Number.parseFloat(recencyScore.toFixed(4))
      },
      passedValidation: true,
      responseTime,
      count,
      mostRecentDate: mostRecentDate?.toISOString()
    };
  });

  // Extract just the scores for backward compatibility
  const scores = finalScores.map(result => result.score);

  // Calculate the mean score
   /* istanbul ignore next */
  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  logger.info(`Scoring complete - Mean: ${meanScore.toFixed(4)}, Scores: [${scores.map(s => s.toFixed(4)).join(', ')}]`);

  return {
    scores,
    meanScore,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    finalScores
  }
}

export default calculateFinalScores
