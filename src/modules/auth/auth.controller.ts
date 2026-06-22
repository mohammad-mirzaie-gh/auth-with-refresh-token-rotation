import { Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login/password')
  loginPassword() {}
  
  @Post('/register')
  register() {}

  @Post('/change/password')
  changePassword() {}

  @Post('/refresh')
  refresh() {}
}
