import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginPasswordDto,
  RefreshTokenDto,
} from './dto/body.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { JwtRefreshGuard } from './guard/jwt-refresh.guard';
import type { Response } from 'express';
import { refreshTokenCookies } from './utils/cookie.title';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login/password')
  async loginPassword(
    @Res({ passthrough: true }) res: Response,
    @Body() body: LoginPasswordDto,
  ) {
    const tokens = await this.authService.login({ ...body });

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
  register() {}

  @UseGuards(JwtAuthGuard)
  @Post('/change/password')
  changePassword(@Body() body: ChangePasswordDto) {}

  @UseGuards(JwtRefreshGuard)
  @Post('/refresh')
  refresh(@Body() body: RefreshTokenDto) {}

  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  logoutOne() {}

  @UseGuards(JwtAuthGuard)
  @Post('/logout/all')
  logoutAll() {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  me() {}
}
