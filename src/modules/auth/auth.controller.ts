import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginPasswordDto,
  RefreshTokenDto,
  RegisterBodyDto,
} from './dto/body.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { JwtRefreshGuard } from './guard/jwt-refresh.guard';
import type { Response } from 'express';
import { refreshTokenCookies } from './utils/cookie.title';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload, RefreshJwtPayload } from './type/jwt-payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login/password')
  async loginPassword(
    @Res({ passthrough: true }) res: Response,
    @Body() body: LoginPasswordDto,
  ) {
    const tokens = await this.authService.login({
      ...body,
    });

    if (body.device === 'WEB') {
      res.cookie(refreshTokenCookies, tokens.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/v2/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // dev mode
        secure: false,
      });

      return { accessToken: tokens.accessToken };
    } else {
      return tokens;
    }
  }

  @Post('/register')
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() body: RegisterBodyDto,
  ) {
    const tokens = await this.authService.register({
      ...body,
    });

    if (body.device === 'WEB') {
      res.cookie(refreshTokenCookies, tokens.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/v2/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // dev mode
        secure: false,
      });

      return { accessToken: tokens.accessToken };
    } else {
      return tokens;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/change/password')
  changePassword(
    @Res({ passthrough: true }) res: Response,
    @Body() body: ChangePasswordDto,
    @CurrentUser() userInfo: JwtPayload,
  ) {
    res.clearCookie(refreshTokenCookies, {
      path: '/api/v2/auth/refresh',
      sameSite: 'lax',
      secure: false,
    });
    return this.authService.changePassword({ ...body, userInfo });
  }

  @UseGuards(JwtRefreshGuard)
  @Post('/refresh')
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshTokenDto,
    @CurrentUser() userInfo: RefreshJwtPayload,
  ) {
    const tokens = await this.authService.refresh({ ...body, ...userInfo });

    if (body.device === 'WEB') {
      res.cookie(refreshTokenCookies, tokens.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/v2/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // dev mode
        secure: false,
      });

      return { accessToken: tokens.accessToken };
    } else {
      return tokens;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  logoutOne(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() userInfo: JwtPayload,
  ) {
    res.clearCookie(refreshTokenCookies, {
      path: '/api/v2/auth/refresh',
      sameSite: 'lax',
      secure: false,
    });
    return this.authService.logout({ ...userInfo });
  }

  @UseGuards(JwtAuthGuard)
  @Post('/logout/all')
  logoutAll(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() userInfo: JwtPayload,
  ) {
    res.clearCookie(refreshTokenCookies, {
      path: '/api/v2/auth/refresh',
      sameSite: 'lax',
      secure: false,
    });
    return this.authService.logoutAll({ ...userInfo });
  }
}
