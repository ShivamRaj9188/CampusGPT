import axiosInstance from './axiosInstance';
import { AuthResponse } from '../types';

/**
 * authService wraps the /api/auth/** endpoints for login and signup.
 */
export const authService = {

  /**
   * POST /api/auth/signup
   * Registers a new user and returns a JWT token.
   */
  signup: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await axiosInstance.post<AuthResponse>('/auth/signup', {
      username,
      email,
      password,
    });
    return response.data;
  },

  /**
   * POST /api/auth/login
   * Authenticates a user and returns a JWT token.
   */
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await axiosInstance.post<AuthResponse>('/auth/login', {
      username,
      password,
    });
    return response.data;
  },
};
