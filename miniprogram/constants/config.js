const ENVIRONMENTS = {
  dev: {
    apiBaseUrl: 'http://localhost:8080',
    uploadBaseUrl: 'http://localhost:8080',
    mediaBaseUrl: '',
    fontFace: null
  },
  prod: {
    apiBaseUrl: 'https://snowlit.xyz',
    uploadBaseUrl: 'https://snowlit.xyz',
    mediaBaseUrl: '',
    fontFace: null
  }
};

const CURRENT_ENV = 'dev';
const activeEnvironment = ENVIRONMENTS[CURRENT_ENV];

const config = {
  env: CURRENT_ENV,
  apiBaseUrl: activeEnvironment.apiBaseUrl,
  uploadBaseUrl: activeEnvironment.uploadBaseUrl,
  mediaBaseUrl: activeEnvironment.mediaBaseUrl,
  fontFace: activeEnvironment.fontFace,
  requestTimeout: 15000,
  uploadTimeout: 30000
};

module.exports = {
  CURRENT_ENV,
  ENVIRONMENTS,
  config
};
