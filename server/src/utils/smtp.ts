import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

// Минимальный SMTP-клиент на стандартных модулях Node (вместо nodemailer):
// TLS или STARTTLS, AUTH PLAIN, письмо в HTML (UTF-8, base64).

export interface SmtpConfig {
  host: string;
  port: number;
  /** true — TLS сразу (обычно порт 465); иначе STARTTLS, если сервер его предлагает. */
  secure: boolean;
  user?: string;
  pass?: string;
}

export interface MailMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

const TIMEOUT_MS = 15_000;

const encodeHeader = (value: string) => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`);

/** «Имя <адрес>» → адрес */
const addressOf = (value: string) => value.match(/<([^>]+)>/)?.[1] ?? value.trim();

/** «Имя <адрес>» с закодированным именем */
function formatAddress(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match && match[1] ? `${encodeHeader(match[1].replace(/"/g, ''))} <${match[2]}>` : addressOf(value);
}

export function buildMessage(msg: MailMessage): string {
  const body = Buffer.from(msg.html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  const domain = addressOf(msg.from).split('@')[1] ?? 'localhost';
  return [
    `From: ${formatAddress(msg.from)}`,
    `To: ${msg.to.join(', ')}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** Читает ответы сервера: многострочный ответ заканчивается строкой «код пробел текст». */
class Connection {
  private buffer = '';
  private waiting: ((line: string) => void) | null = null;
  private lines: string[] = [];
  private socket: net.Socket;
  private error: Error | null = null;

  constructor(socket: net.Socket) {
    this.socket = socket;
    this.attach(socket);
  }

  private attach(socket: net.Socket) {
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('SMTP: превышено время ожидания')));
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let index: number;
      while ((index = this.buffer.indexOf('\r\n')) >= 0) {
        const line = this.buffer.slice(0, index);
        this.buffer = this.buffer.slice(index + 2);
        if (this.waiting) {
          const resolve = this.waiting;
          this.waiting = null;
          resolve(line);
        } else this.lines.push(line);
      }
    });
    socket.on('error', (err) => {
      this.error = err;
      this.waiting?.('');
    });
  }

  private nextLine(): Promise<string> {
    if (this.lines.length) return Promise.resolve(this.lines.shift()!);
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve) => (this.waiting = resolve));
  }

  async read(expected: number[]): Promise<string> {
    const all: string[] = [];
    for (;;) {
      const line = await this.nextLine();
      if (this.error) throw this.error;
      all.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) break;
    }
    const code = Number(all[all.length - 1].slice(0, 3));
    if (!expected.includes(code)) throw new Error(`SMTP: неожиданный ответ ${all.join(' | ')}`);
    return all.join('\n');
  }

  async command(line: string, expected: number[]): Promise<string> {
    this.socket.write(`${line}\r\n`);
    return this.read(expected);
  }

  async upgrade(host: string) {
    this.socket.removeAllListeners('data');
    const secure = tls.connect({ socket: this.socket, servername: host });
    await new Promise<void>((resolve, reject) => {
      secure.once('secureConnect', resolve);
      secure.once('error', reject);
    });
    this.socket = secure;
    this.attach(secure);
  }

  close() {
    this.socket.end();
  }
}

export async function sendSmtp(config: SmtpConfig, msg: MailMessage): Promise<void> {
  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  await new Promise<void>((resolve, reject) => {
    socket.once(config.secure ? 'secureConnect' : 'connect', () => resolve());
    socket.once('error', reject);
  });

  const conn = new Connection(socket);
  try {
    await conn.read([220]);
    let ehlo = await conn.command('EHLO localhost', [250]);
    if (!config.secure && /STARTTLS/i.test(ehlo)) {
      await conn.command('STARTTLS', [220]);
      await conn.upgrade(config.host);
      ehlo = await conn.command('EHLO localhost', [250]);
    }
    if (config.user) {
      const token = Buffer.from(`\0${config.user}\0${config.pass ?? ''}`).toString('base64');
      await conn.command(`AUTH PLAIN ${token}`, [235]);
    }
    await conn.command(`MAIL FROM:<${addressOf(msg.from)}>`, [250]);
    for (const to of msg.to) await conn.command(`RCPT TO:<${addressOf(to)}>`, [250, 251]);
    await conn.command('DATA', [354]);
    // Строки, начинающиеся с точки, удваиваются (dot-stuffing)
    const data = buildMessage(msg).replace(/^\./gm, '..');
    await conn.command(`${data}\r\n.`, [250]);
    await conn.command('QUIT', [221]).catch(() => {});
  } finally {
    conn.close();
  }
}
