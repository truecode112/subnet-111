import { City, State }  from 'country-state-city';
import random from '#modules/random/index.js';

/**
 * Get a random location in the US
 * @returns {string} - The random location
 */
const getRandomLocation = () => {
  const states = State.getStatesOfCountry('US')
  const randomState = random.fromArray(states);
  const cities = City.getCitiesOfState('US', randomState.isoCode);
  const randomCity = random.fromArray(cities);
  const location = `${randomCity.name}, ${randomState.name}`;
  return location;
}

export default getRandomLocation;
