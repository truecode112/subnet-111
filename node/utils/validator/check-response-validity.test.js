import checkResponseValidity from './check-response-validity.js';

jest.mock('#modules/logger/index.js', () => ({
  error: jest.fn(),
}));

describe('#utils/validator/check-response-validity.js', () => {
  let response;
  let minerUID;

  beforeEach(() => {
    response = [1,2,3];
    minerUID = 1;
  });

  test('should fail if the response is not an object', () => {
    const result = checkResponseValidity();
    expect(result.isValid).toEqual(false);
    expect(result.validationError).toEqual('Response is not an array');
  });

  test('should fail if the response is not an array', () => {
    response = {};
    const result = checkResponseValidity(response, minerUID);
    expect(result.isValid).toEqual(false);
    expect(result.validationError).toEqual('Response is not an array');
  });

  test('should fail if the response is an empty array', () => {
    response = [];
    const result = checkResponseValidity(response, minerUID);
    expect(result.isValid).toEqual(false);
    expect(result.validationError).toEqual('Response is empty');
  });

  test('should return properly', () => {
    const result = checkResponseValidity(response, minerUID);
    expect(result.isValid).toEqual(true);
  });
});
