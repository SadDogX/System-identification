import { config } from './config.ts';
import { logger } from './logger.ts';
import { sendSmtp } from './smtp.ts';

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Почта включена, если в .env задан SMTP_HOST. */
export const mailEnabled = () => !!config.smtp;

/**
 * Отправка письма. Никогда не бросает исключение — ошибка почты не должна ломать основное действие;
 * результат (true — отправлено) можно дождаться, если он важен.
 */
export function sendMail(to: string | string[], subject: string, html: string): Promise<boolean> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!config.smtp || recipients.length === 0) return Promise.resolve(false);
  return sendSmtp(config.smtp, { from: config.smtp.from, to: recipients, subject, html })
    .then(() => logger.info(`Письмо «${subject}» отправлено: ${recipients.join(', ')}`))
    .then(() => true)
    .catch((err) => {
      logger.error(`Не удалось отправить письмо «${subject}»`, err.message);
      return false;
    });
}

export interface ExpiryLine {
  fullName?: string;
  credential: string;
  expiryDate: string; // ДД.ММ.ГГГГ
  status: 'RED' | 'YELLOW';
  daysText: string;
}

const COLORS = { RED: '#c62828', YELLOW: '#b26a00' };

/** HTML-письмо со списком удостоверений, у которых подходит или истёк срок. */
export function expiryEmail(opts: { greeting: string; intro: string; lines: ExpiryLine[]; link: string }) {
  const withUser = opts.lines.some((l) => l.fullName);
  const rows = opts.lines
    .map(
      (l) => `<tr>
        ${withUser ? `<td style="padding:6px 10px;border-bottom:1px solid #e3e7eb">${escape(l.fullName ?? '')}</td>` : ''}
        <td style="padding:6px 10px;border-bottom:1px solid #e3e7eb">${escape(l.credential)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e3e7eb">${l.expiryDate}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e3e7eb;color:${COLORS[l.status]};font-weight:600">${escape(l.daysText)}</td>
      </tr>`,
    )
    .join('');
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1f2933">
    <p>${escape(opts.greeting)}</p>
    <p>${escape(opts.intro)}</p>
    <table style="border-collapse:collapse">
      <tr style="color:#6b7280;font-size:12px;text-align:left">
        ${withUser ? '<th style="padding:6px 10px">Сотрудник</th>' : ''}
        <th style="padding:6px 10px">Удостоверение</th><th style="padding:6px 10px">Действительно до</th><th style="padding:6px 10px">Срок</th>
      </tr>${rows}
    </table>
    <p><a href="${config.appUrl}${opts.link}" style="color:#1f4e79">Открыть систему учёта удостоверений</a></p>
    <p style="color:#6b7280;font-size:12px">Письмо отправлено автоматически, отвечать на него не нужно.</p>
  </div>`;
}
