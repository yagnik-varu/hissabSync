import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { hashPassword, comparePassword } from '../utils/password.util';
import { ConfigModule } from '@nestjs/config';
import jwtConfig from '../../../config/jwt.config';

describe('Auth Utilities and JWT (Throwaway Test)', () => {
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [jwtConfig],
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
  });

  it('should hash and verify passwords using bcrypt', async () => {
    const plainText = 'mySuperSecretPassword123!';
    const hashed = await hashPassword(plainText);
    
    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(plainText);
    
    const isMatch = await comparePassword(plainText, hashed);
    expect(isMatch).toBe(true);
    
    const isFalseMatch = await comparePassword('wrongPassword', hashed);
    expect(isFalseMatch).toBe(false);
  });

  it('should sign and verify access and refresh tokens', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com' };
    
    // Test Access Token (15m)
    const accessToken = await jwtService.signAsync(payload);
    expect(accessToken).toBeDefined();
    
    const decodedAccess = await jwtService.verifyAsync(accessToken, { secret: 'test-secret' });
    expect(decodedAccess.sub).toBe('user-123');
    
    // Test Refresh Token (7d)
    const refreshToken = await jwtService.signAsync(payload, {
      secret: 'refresh-secret',
      expiresIn: '7d',
    });
    expect(refreshToken).toBeDefined();
    
    const decodedRefresh = await jwtService.verifyAsync(refreshToken, { secret: 'refresh-secret' });
    expect(decodedRefresh.sub).toBe('user-123');
  });
});
