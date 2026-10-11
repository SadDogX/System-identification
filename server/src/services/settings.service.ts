import { DEFAULT_THRESHOLDS, DEFAULT_TIMEZONE, todayInTimezone, type AppSettingsDto } from '@app/shared';
import { prisma } from '../db';

const DEFAULTS: Record<keyof AppSettingsDto, string> = {
  yellowDays: String(DEFAULT_THRESHOLDS.yellowDays),
  redDays: String(DEFAULT_THRESHOLDS.redDays),
  timezone: DEFAULT_TIMEZONE,
};

export async function getSettings(): Promise<AppSettingsDto> {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return {
    yellowDays: Number(map.yellowDays),
    redDays: Number(map.redDays),
    timezone: map.timezone,
  };
}

/** Настройки + текущая дата в часовом поясе организации. */
export async function getDateContext() {
  const settings = await getSettings();
  return { settings, today: todayInTimezone(settings.timezone) };
}
