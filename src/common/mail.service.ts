import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type MailContent = { subject: string; text: string; html?: string };

/** SMTP sender shared by features outside auth (e.g. selection emails). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, { subject, text, html }: MailContent) {
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.error(`SMTP is not configured; cannot email ${to}`);
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Please contact support.',
      );
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(this.configService.get<number>('SMTP_PORT') ?? 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
    this.logger.log(`Sending email to ${to} | subject: ${subject}`);
    await transporter.sendMail({
      from:
        this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com',
      to,
      subject,
      text,
      html,
    });
  }
}
