/**
 * Get a random element from an array
 * @param {Array} array - The array to get a random element from
 * @returns {any} - The random element
 */
function fromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random number between a min and max
 * @param {number} min - The minimum number
 * @param {number} max - The maximum number
 * @returns {number} - The random number
 */
function between(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default {
  fromArray,
  between
};
