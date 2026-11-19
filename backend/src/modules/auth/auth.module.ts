import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './infrastructure/auth.controller';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard';
import { RolesGuard } from './infrastructure/roles.guard';

/** RF-07: sesión con JWT. Registra los guards globales (token y roles). */
@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '8h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
