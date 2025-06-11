import generateValidationData from './validation-data.js';

describe('#utils/validator/validation-data.js', () => {
  test('should generate the validation data properly', () => {
    const result = generateValidationData({ minerUID: 1 });
    expect(result.minerUID).toEqual(1);
  });
});
