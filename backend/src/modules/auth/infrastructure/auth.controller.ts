import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import type { AuthPayload } from '../auth.decorators';
import { CurrentUser, Public } from '../auth.decorators';

/**
 * Rutas:
 *   POST /auth/login        → { accessToken, user }
 *   GET  /auth/me           → usuario del token
 *   POST /auth/recuperar    → envía enlace de restablecimiento por correo
 *   POST /auth/restablecer  → cambia la contraseña con el token del enlace
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

  @Public()
  @Post('recuperar')
  @HttpCode(200)
  recuperar(
    @Body() body: { email?: string },
    @Headers('origin') origin?: string,
  ) {
    return this.auth.requestReset(body?.email, origin);
  }

  @Public()
  @Post('restablecer')
  @HttpCode(200)
  restablecer(@Body() body: { token?: string; password?: string }) {
    return this.auth.resetPassword(body?.token, body?.password);
  }
}
