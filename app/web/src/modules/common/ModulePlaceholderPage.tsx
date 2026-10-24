import { Icon, type IconName } from '@app/shared/ui';

export function ModulePlaceholderPage({ title, description, icon }: { title: string; description: string; icon: IconName }) {
  return (
    <section className="module-placeholder">
      <div className="module-placeholder-icon">
        <Icon name={icon} />
      </div>
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      <div className="module-placeholder-card">
        <strong>Раздел готов к наполнению</strong>
        <span>Здесь будут размещены функции модуля «{title}».</span>
      </div>
    </section>
  );
}
