import { daysLeftText, formatDateRu, type UserCredentialDto, type UserDto } from '@app/shared';

/** Черновик сообщения, который карточка сотрудника передаёт на страницу «Сообщения». */
export interface MessageDraft {
  userId: number;
  subject: string;
  body: string;
}

let pending: MessageDraft | null = null;

export function setMessageDraft(draft: MessageDraft) {
  pending = draft;
}

/** Забрать черновик (один раз). */
export function takeMessageDraft(): MessageDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}

/** Оповещение о красных и жёлтых удостоверениях сотрудника; без них — пустое сообщение этому сотруднику. */
export function buildExpiryDraft(user: UserDto, credentials: UserCredentialDto[]): MessageDraft {
  const problems = credentials
    .filter((c) => !c.isMarkedForDeletion && (c.status === 'RED' || c.status === 'YELLOW'))
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  if (problems.length === 0) return { userId: user.id, subject: '', body: '' };

  const anyRed = problems.some((c) => c.status === 'RED');
  const lines = problems.map((c) => `— ${c.name}: действительно до ${formatDateRu(c.expiryDate)} (${daysLeftText(c.daysLeft)})`);
  return {
    userId: user.id,
    subject: anyRed
      ? 'Оповещение: истекает или истёк срок действия удостоверения'
      : 'Оповещение: подходит срок действия удостоверения',
    body: [
      `Уважаемый(ая) ${user.fullName}!`,
      '',
      anyRed
        ? 'У вас истекает или уже закончился срок действия удостоверений:'
        : 'У вас подходит к концу срок действия удостоверений:',
      ...lines,
      '',
      'Пожалуйста, своевременно продлите удостоверения и внесите новые даты в системе учёта.',
    ].join('\n'),
  };
}
