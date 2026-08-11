import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { UserRepository } from '../../src/modules/auth/repositories/user.repository';

// Mock password utils to avoid slow hashing in unit tests
jest.mock('../../src/modules/auth/utils/password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  comparePassword: jest.fn((plain, hash) => Promise.resolve(plain === 'correct_password' || hash === 'hashed_password')),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateProfile: jest.fn(),
      updatePassword: jest.fn(),
      storeRefreshToken: jest.fn(),
      findRefreshTokensByUserId: jest.fn(),
      deleteRefreshToken: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_token'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user_id', email: 'test@example.com' }),
      decode: jest.fn().mockReturnValue({ exp: 1234567890 }),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('mock_secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({
        id: 'user_id',
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        passwordHash: 'hashed_password',
        profileImageUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.register({
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'correct_password',
      });

      expect(result.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
      expect(result.user.email).toBe('test@example.com');
      expect(userRepository.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing_id' } as any);

      await expect(authService.register({
        fullName: 'Test',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'correct_password',
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login user successfully with correct credentials', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user_id',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
      } as any);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'correct_password',
      });

      expect(result.accessToken).toBe('mock_token');
      expect(userRepository.storeRefreshToken).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login({
        email: 'wrong@example.com',
        password: 'correct_password',
      })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate refresh token successfully', async () => {
      userRepository.findRefreshTokensByUserId.mockResolvedValue([
        { id: 'token_id', tokenHash: 'hashed_password', expiresAt: new Date(), userId: 'user_id' } as any
      ]);
      userRepository.findByEmail.mockResolvedValue({ id: 'user_id', isActive: true, email: 'test@example.com' } as any);

      const result = await authService.refresh({ refreshToken: 'correct_password' });

      expect(userRepository.deleteRefreshToken).toHaveBeenCalledWith('token_id');
      expect(result.accessToken).toBe('mock_token');
    });

    it('should throw UnauthorizedException if token is invalid or not in DB', async () => {
      userRepository.findRefreshTokensByUserId.mockResolvedValue([]);

      await expect(authService.refresh({ refreshToken: 'invalid_token' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete the matching refresh token', async () => {
      userRepository.findRefreshTokensByUserId.mockResolvedValue([
        { id: 'token_id', tokenHash: 'hashed_password' } as any
      ]);

      await authService.logout('user_id', 'correct_password');

      expect(userRepository.deleteRefreshToken).toHaveBeenCalledWith('token_id');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      userRepository.findById.mockResolvedValue({ id: 'user_id', passwordHash: 'hashed_password' } as any);

      await authService.changePassword('user_id', {
        currentPassword: 'correct_password',
        newPassword: 'new_password',
      });

      expect(userRepository.updatePassword).toHaveBeenCalledWith('user_id', 'hashed_password');
    });
  });
});
