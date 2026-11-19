import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import type { AuthPayload } from '../auth.decorators';
import { CurrentUser, Public } from '../auth.decorators';

/**
 * Rutas:
 *   POST /auth/login        → { accessToken, user }
 *   GET  /auth/me           → usuario del token
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body?.email, body?.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthPayload) {
    return this.auth.me(user.sub);
  }
}
