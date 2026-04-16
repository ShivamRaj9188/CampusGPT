import axiosInstance from './axiosInstance';
import { AuthResponse, UserProfileResponse } from '../types';

export const userService = {
  getProfile: async (): Promise<UserProfileResponse> => {
    const response = await axiosInstance.get<UserProfileResponse>('/user/profile');
    return response.data;
  },

  updateProfile: async (username: string, email: string): Promise<AuthResponse> => {
    const response = await axiosInstance.put<AuthResponse>('/user/profile', { username, email });
    return response.data;
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await axiosInstance.put('/user/password', { currentPassword, newPassword });
  },
};
