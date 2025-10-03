import type { Context } from 'hono';
import type { ApiResponse, User } from '../../shared/types/api';

export type HonoContext = Context;

export interface UserService {
  getUsers(): Promise<User[]>;
  getUserById(_id: string): Promise<User | undefined>;
  createUser(_user: Omit<User, 'id'>): Promise<User>;
}

export type ApiHandler<T = unknown> = (
  _c: HonoContext
) => Response | Promise<Response> | ApiResponse<T> | Promise<ApiResponse<T>>;
