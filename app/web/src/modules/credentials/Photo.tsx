import { useEffect, useRef, useState } from 'react';
import { PHOTO_MAX_BYTES, PHOTO_TYPES, type UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction } from '../../core/data.ts';
import { Icon, Alert, Dialog } from '@app/shared/ui';

const photoUrl = (id: number) => `/credentials/${id}/photo`;

/** Загружает фото с авторизацией и отдаёт адрес для <img> / ссылки. */
function usePhotoUrl(id: number | null, version: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null || !version) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setError(null);
    api
      .blob(photoUrl(id))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, version]);

  return { url, error };
}

function Preview({ item }: { item: UserCredentialDto }) {
  const { url, error } = usePhotoUrl(item.id, item.photoMime ? `${item.photoMime}:${item.updatedAt}` : null);
  if (error) return <Alert>{error}</Alert>;
  if (!url) return <div className="muted">Загрузка…</div>;
  if (item.photoMime === 'application/pdf') {
    return (
      <a className="btn btn-outline" href={url} target="_blank" rel="noreferrer">
        Открыть PDF
      </a>
    );
  }
  return <img className="photo-full" src={url} alt={`Фото: ${item.name}`} />;
}

/** Кнопка «посмотреть фото» в таблице и карточках. */
export function PhotoButton({ item }: { item: UserCredentialDto }) {
  const [open, setOpen] = useState(false);
  if (!item.photoMime) return null;
  return (
    <>
      <button type="button" className="icon-btn" title="Фото удостоверения" aria-label="Фото удостоверения" onClick={() => setOpen(true)}>
        <Icon name="photo" />
      </button>
      <Dialog
        open={open}
        wide
        title={item.name}
        onClose={() => setOpen(false)}
        actions={
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Закрыть
          </button>
        }
      >
        {item.user && <div className="muted">{item.user.fullName}</div>}
        {open && <Preview item={item} />}
      </Dialog>
    </>
  );
}

/** Блок в диалоге редактирования: превью, загрузка, удаление. */
export function PhotoField({ item }: { item: UserCredentialDto }) {
  const input = useRef<HTMLInputElement>(null);
  const [mime, setMime] = useState(item.photoMime);
  const [version, setVersion] = useState(item.updatedAt);
  const [localError, setLocalError] = useState<string | null>(null);
  const { url } = usePhotoUrl(item.id, mime ? `${mime}:${version}` : null);

  useEffect(() => {
    setMime(item.photoMime);
    setVersion(item.updatedAt);
  }, [item.id, item.photoMime, item.updatedAt]);

  const upload = useAction((file: File) => api.upload<{ photoMime: string }>(photoUrl(item.id), file), {
    onSuccess: (res) => {
      setMime(res.photoMime);
      setVersion(String(Date.now()));
      invalidate('me');
      invalidate('admin');
    },
  });
  const remove = useAction(() => api.delete(photoUrl(item.id)), {
    onSuccess: () => {
      setMime(null);
      invalidate('me');
      invalidate('admin');
    },
  });

  const pick = (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return setLocalError('Поддерживаются JPG, PNG, WebP или PDF');
    if (file.size > PHOTO_MAX_BYTES) return setLocalError('Файл больше 5 МБ');
    upload.run(file);
  };

  const error = localError ?? (upload.error ? errorMessage(upload.error) : remove.error ? errorMessage(remove.error) : null);

  return (
    <div className="field">
      <label>Фото или скан удостоверения</label>
      <div className="photo-box">
        {mime && url && mime !== 'application/pdf' && <img className="photo-thumb" src={url} alt="Фото удостоверения" />}
        {mime === 'application/pdf' && url && (
          <a href={url} target="_blank" rel="noreferrer">
            Открыть PDF
          </a>
        )}
        {!mime && <span className="muted">Не загружено</span>}
        <div className="row wrap">
          <button type="button" className="btn btn-sm btn-outline" disabled={upload.pending} onClick={() => input.current?.click()}>
            <Icon name="upload" small /> {mime ? 'Заменить' : 'Загрузить'}
          </button>
          {mime && (
            <button type="button" className="btn btn-sm" disabled={remove.pending} onClick={() => remove.run()}>
              <Icon name="delete" small /> Удалить
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept={PHOTO_TYPES.join(',')}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <div className="help">{upload.pending ? 'Загрузка…' : 'JPG, PNG, WebP или PDF, до 5 МБ'}</div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
