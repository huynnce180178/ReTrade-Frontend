const LOCAL_API_URL = 'http://localhost:8386/api';
const DEPLOYED_API_URL = 'https://retrade-api.bluesky-352d5cc4.eastasia.azurecontainerapps.io/api';

const resolveBaseApiUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return LOCAL_API_URL;
  }

  return DEPLOYED_API_URL;
};

export const BASE_API_URL = resolveBaseApiUrl();

export default BASE_API_URL;
