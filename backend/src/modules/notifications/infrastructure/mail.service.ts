import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly defaultFrom: string;

  constructor(private readonly config: ConfigService) {
    this.defaultFrom =
      this.config.get<string>('MAIL_FROM') || 'HosPal PMS <no-reply@hospal.local>';
    this.initTransporter();
  }

  async onModuleInit(): Promise<void> {
    await this.verifyConnection();
  }

  private initTransporter(): void {
    const host = this.config.get<string>('MAIL_HOST') || 'localhost';
    const port = Number(this.config.get<number>('MAIL_PORT') || 1025);
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASS');
    const secure = this.config.get<string>('MAIL_SECURE') === 'true' || port === 465;

    const transportOptions: any = {
      host,
      port,
      secure,
    };

    if (user && pass) {
      transportOptions.auth = { user, pass };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    this.logger.log(
      `MailService configurado para ${host}:${port} (secure=${secure}, user=${user || 'ninguno'}, from=${this.defaultFrom})`
    );
  }

  /**
   * Verifica la conectividad con el servidor SMTP al arrancar.
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }
    try {
      await this.transporter!.verify();
      this.logger.log('Conexión con el servidor SMTP verificada exitosamente.');
      return true;
    } catch (error: any) {
      const details = error?.response || error?.message || String(error);
      this.logger.warn(
        `No se pudo verificar la conexión SMTP al arrancar: ${details}. Las notificaciones intentarán conectar al momento del envío.`
      );
      return false;
    }
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    if (!this.transporter) {
      this.initTransporter();
    }

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.replyTo && options.replyTo.trim()) {
        mailOptions.replyTo = options.replyTo.trim();
      }

      const info = await this.transporter!.sendMail(mailOptions);
      this.logger.log(`Correo enviado a ${options.to} [${options.subject}] (id: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      const fullError = [
        error?.code ? `[Code: ${error.code}]` : '',
        error?.response ? `[Response: ${error.response}]` : '',
        error?.message || String(error),
      ]
        .filter(Boolean)
        .join(' ');

      this.logger.error(`Error enviando correo a ${options.to}: ${fullError}`, error?.stack);
      return { success: false, error: fullError };
    }
  }
}
