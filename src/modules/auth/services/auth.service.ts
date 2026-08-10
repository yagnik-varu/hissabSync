import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repositories/user.repository';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { RefreshDto } from '../dtos/refresh.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { hashPassword, comparePassword } from '../utils/password.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('AUTH_EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(registerDto.password);

    const user = await this.userRepository.create({
      fullName: registerDto.fullName,
      email: registerDto.email,
      passwordHash,
      phone: registerDto.phone,
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshDto: RefreshDto) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshDto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const storedTokens = await this.userRepository.findRefreshTokensByUserId(payload.sub);

      let matchedTokenId: string | null = null;
      for (const token of storedTokens) {
        const isMatch = await comparePassword(refreshDto.refreshToken, token.tokenHash);
        if (isMatch) {
          matchedTokenId = token.id;
          break;
        }
      }

      if (!matchedTokenId) {
        // Token is not in the database (revoked or already rotated)
        throw new UnauthorizedException('AUTH_REFRESH_TOKEN_INVALID');
      }

      // Rotate: delete the old token
      await this.userRepository.deleteRefreshToken(matchedTokenId);

      // Verify user is still active
      const user = await this.userRepository.findByEmail(payload.email);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
      }

      // Issue new pair
      const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('AUTH_REFRESH_TOKEN_INVALID');
    }
  }

  async logout(userId: string, refreshToken: string) {
    const storedTokens = await this.userRepository.findRefreshTokensByUserId(userId);
    
    let matchedTokenId: string | null = null;
    for (const token of storedTokens) {
      const isMatch = await comparePassword(refreshToken, token.tokenHash);
      if (isMatch) {
        matchedTokenId = token.id;
        break;
      }
    }

    if (matchedTokenId) {
      await this.userRepository.deleteRefreshToken(matchedTokenId);
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      profileImageUrl: user.profileImageUrl,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.userRepository.updateProfile(userId, {
      fullName: updateProfileDto.fullName,
      phone: updateProfileDto.phone,
      profileImageUrl: updateProfileDto.profileImageUrl,
    });

    return {
      id: updatedUser.id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      profileImageUrl: updatedUser.profileImageUrl,
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    const isPasswordValid = await comparePassword(changePasswordDto.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('AUTH_INVALID_CREDENTIALS');
    }

    const newPasswordHash = await hashPassword(changePasswordDto.newPassword);
    await this.userRepository.updatePassword(userId, newPasswordHash);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') as any,
    });

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    const tokenHash = await hashPassword(refreshToken);
    await this.userRepository.storeRefreshToken(userId, tokenHash, expiresAt);

    return { accessToken, refreshToken };
  }
}
