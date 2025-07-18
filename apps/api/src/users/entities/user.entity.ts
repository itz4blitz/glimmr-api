export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'api-user';
  apiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}