import { Pool } from 'pg';
import { UserModel } from '../models/UserModel';
import { hashPassword, comparePassword } from '../utils/hash';
import { signToken } from '../utils/jwt';
import { ValidationError, UnauthorizedError, ConflictError } from '../utils/errors';

function sanitizeUser(user: any) {
  const { password_hash, oauth_id, ...safe } = user;
  return safe;
}

export class AuthService {
  private userModel: UserModel;

  constructor(pool: Pool) {
    this.userModel = new UserModel(pool);
  }

  async register(input: { email: string; username: string; password: string; display_name?: string }) {
    // Validate password length >= 8
    if (input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Check email uniqueness
    const existingEmail = await this.userModel.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    // Check username uniqueness
    const existingUsername = await this.userModel.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    // Hash password
    const password_hash = await hashPassword(input.password);

    // Create user
    let user;
    try {
      user = await this.userModel.create({
        email: input.email,
        username: input.username,
        display_name: input.display_name,
        password_hash,
      });
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.constraint?.includes('email')) {
          throw new ConflictError('Email already registered');
        }
        if (error.constraint?.includes('username')) {
          throw new ConflictError('Username already taken');
        }
        throw new ConflictError('User already exists');
      }
      throw error;
    }

    // Sign JWT
    const token = signToken({ userId: user.id, type: 'human' });

    // Return { user (without password_hash), token }
    return {
      user: sanitizeUser(user),
      token,
    };
  }

  async login(input: { email: string; password: string }) {
    // Find user by email
    const user = await this.userModel.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Compare password
    const isPasswordValid = await comparePassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Sign JWT
    const token = signToken({ userId: user.id, type: 'human' });

    // Return { user (without password_hash), token }
    return {
      user: sanitizeUser(user),
      token,
    };
  }

  async googleLogin(googleUser: {
    googleId: string;
    email: string;
    name?: string;
    picture?: string;
  }) {
    // 1. Try finding by OAuth credentials
    let user = await this.userModel.findByOAuth('google', googleUser.googleId);

    if (!user) {
      // 2. Try finding by email — link Google to existing account
      user = await this.userModel.findByEmail(googleUser.email);
      if (user) {
        user = await this.userModel.update(user.id, {
          oauth_provider: 'google',
          oauth_id: googleUser.googleId,
          avatar_url: user.avatar_url || googleUser.picture,
        });
      }
    }

    if (!user) {
      // 3. Create new user
      const emailPrefix = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      let username = emailPrefix.substring(0, 40);

      // Ensure username uniqueness
      let existing = await this.userModel.findByUsername(username);
      if (existing) {
        const suffix = Math.random().toString(36).substring(2, 7);
        username = `${username.substring(0, 43)}_${suffix}`;
      }

      user = await this.userModel.create({
        email: googleUser.email,
        username,
        display_name: googleUser.name,
        avatar_url: googleUser.picture,
        oauth_provider: 'google',
        oauth_id: googleUser.googleId,
        password_hash: null,
      });
    }

    const token = signToken({ userId: user.id, type: 'human' });

    return {
      user: sanitizeUser(user),
      token,
    };
  }

  async getMe(userId: string) {
    // Find user by id
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Return user without password_hash
    return sanitizeUser(user);
  }
}
