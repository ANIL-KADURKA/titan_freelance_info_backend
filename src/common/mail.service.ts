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
    const port = Number(this.configService.get<number>('SMTP_PORT') ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      // 465 is TLS from the start; 587/25 upgrade with STARTTLS.
      secure: port === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      // Fail fast instead of nodemailer's 2-minute defaults, so a blocked or
      // unreachable mail server doesn't hang the request.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    this.logger.log(`Sending email to ${to} | subject: ${subject}`);
    try {
      await transporter.sendMail({
        from:
          this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com',
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      this.logger.error(
        `Email to ${to} failed (${code ?? 'unknown'}): ${String(error)}`,
      );
      if (
        code === 'ETIMEDOUT' ||
        code === 'ECONNECTION' ||
        code === 'ESOCKET'
      ) {
        throw new ServiceUnavailableException(
          "We couldn't reach the email server, so nothing was sent. Please try again later.",
        );
      }
      throw error;
    }
  }
}
