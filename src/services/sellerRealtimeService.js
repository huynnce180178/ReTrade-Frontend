import * as signalR from '@microsoft/signalr';
import BASE_API_URL from './base.api.url';

const getHubUrl = () => BASE_API_URL.replace(/\/api\/?$/i, '/hubs/sellers');

export const createSellerHubConnection = () => {
  const token = localStorage.getItem('token');

  return new signalR.HubConnectionBuilder()
    .withUrl(getHubUrl(), {
      accessTokenFactory: () => token || '',
      withCredentials: true,
    })
    .withAutomaticReconnect()
    .build();
};
