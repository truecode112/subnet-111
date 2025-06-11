const baseValidationData = {
  minerUID: undefined,
  passedValidation: false,
  validationError: undefined,
  count: 0,
  mostRecentDate: undefined,
  data: [],
  components: {
    speedScore: 0,
    volumeScore: 0,
    recencyScore: 0
  },
  responseTime: undefined,
};

const generateValidationData = (parameters) => {
  return {
    ...baseValidationData,
    ...parameters
  }
}

export default generateValidationData
