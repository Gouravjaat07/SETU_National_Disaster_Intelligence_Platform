import Constants from 'expo-constants';

const configured = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl;
export const API_URL = `${(configured || 'http://localhost:8000').replace(/\/$/, '')}/api`;
export const TOKEN_KEY = 'setu.mobile.token';
