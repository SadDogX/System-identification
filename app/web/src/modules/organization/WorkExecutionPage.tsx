import { useState } from 'react';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { ActionError } from '../../widgets/feedback/ActionError';

interface Base { id: number; name: string; code: string | null }
interface Mine { id: number; name: string; baseId: number; base: Base }
interface Well { id: number; name: string; code: string | null; contractBases?: { contract: { number: string } | null; addendum: { number: string } | null }[] }
interface Customer { id: number; name: string; code: string | null; isActive: boolean }
interface CustomerSiteWork { id: number; name: string; customer: { id: number; name: string }; startsAt: string; expectedEndAt: string }
interface WorkType { id: number; name: string; code: string; requiresContractPermission: boolean }
interface Status { id: number; code: string; name: string; isActive: boolean; allowsWork?: boolean }
interface Contract {
  id: number;
  number: string;
  startsAt: string;
  endsAt: string;
  customer: Customer;
  status: Status;
  addenda: { id: number; number: string; startsAt: string; endsAt: string; status: Status }[];
}
interface ContractDocument { id: number; name: string; mime: string; createdAt: string }
interface Employee {
  id: number;
  user: { systemRoles: { systemRole: { code: string } }[] };
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function WorkExecutionPage() {
  const user = useCurrentUser();
  const isAdmin = user.systemRoles.includes('ADMIN');
  const selfQuery = useQuery('org:work:self', () => api.get<Employee>(`/org/users/${user.id}/employee`));
  const isManager = selfQuery.data?.user.systemRoles.some((grant) => grant.systemRole.code === 'MANAGER') ?? false;
  const canManageWork = isAdmin || isManager;
  const [baseId, setBaseId] = useState('');
  const [mineId, setMineId] = useState('');
  const [wellId, setWellId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [addendumId, setAddendumId] = useState('');
  const [workTypeId, setWorkTypeId] = useState('');
  const [customerSiteWorkId, setCustomerSiteWorkId] = useState('');
  const [workStatusId, setWorkStatusId] = useState('');
  const [performedAt, setPerformedAt] = useState(today());
  const [contractStart, setContractStart] = useState(today());
  const [contractEnd, setContractEnd] = useState('');
  const [workPermission, setWorkPermission] = useState(true);
  const [workTypeName, setWorkTypeName] = useState('');
  const [workTypeCode, setWorkTypeCode] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [wellBasisStart, setWellBasisStart] = useState(today());
  const [wellBasisEnd, setWellBasisEnd] = useState('');
  const [basisWellIds, setBasisWellIds] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const basesQuery = useQuery(canManageWork ? 'org:work:bases' : null, () => api.get<Base[]>('/org/bases'));
  const minesQuery = useQuery(canManageWork ? 'org:work:mines' : null, () => api.get<Mine[]>('/org/mines'));
  const customersQuery = useQuery(canManageWork ? 'org:work:customers' : null, () => api.get<Customer[]>('/org/customers'));
  const workTypesQuery = useQuery(canManageWork ? 'org:work:types' : null, () => api.get<WorkType[]>('/org/work-types'));
  const workStatusesQuery = useQuery(canManageWork ? 'org:work:statuses' : null, () => api.get<Status[]>('/org/statuses/work'));
  const contractStatusesQuery = useQuery(canManageWork ? 'org:work:contract-statuses' : null, () => api.get<Status[]>('/org/statuses/contract'));
  const addendumStatusesQuery = useQuery(canManageWork ? 'org:work:addendum-statuses' : null, () => api.get<Status[]>('/org/statuses/addendum'));
  const contractsQuery = useQuery(
    canManageWork && baseId ? `org:work:contracts:${baseId}` : null,
    () => api.get<Contract[]>(`/org/bases/${baseId}/contracts`),
  );
  const wellsQuery = useQuery(
    canManageWork && mineId ? `org:work:wells:${mineId}` : null,
    () => api.get<Well[]>(`/org/mines/${mineId}/wells`),
  );
  const customerSiteWorksQuery = useQuery(
    canManageWork && wellId ? `org:work:customer-site-works:${wellId}` : null,
    () => api.get<CustomerSiteWork[]>(`/org/wells/${wellId}/customer-site-works`),
  );
  const bases = basesQuery.data ?? [];
  const mines = minesQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const workTypes = workTypesQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const wells = wellsQuery.data ?? [];
  const customerSiteWorks = customerSiteWorksQuery.data ?? [];
  const selectedContract = contracts.find((contract) => String(contract.id) === contractId);
  const selectableCustomerSiteWorks = selectedContract
    ? customerSiteWorks.filter((work) => work.customer.id === selectedContract.customer.id)
    : customerSiteWorks;
  const selectedWorkType = workTypes.find((type) => String(type.id) === workTypeId);
  const availableAddenda = selectedContract?.addenda ?? [];
  const activeContractStatus = (contractStatusesQuery.data ?? []).find((status) => status.code === 'ACTIVE');
  const activeAddendumStatus = (addendumStatusesQuery.data ?? []).find((status) => status.code === 'ACTIVE');
  const defaultWorkStatus = (workStatusesQuery.data ?? []).find((status) => status.code === 'COMPLETED');
  const sameBaseMines = mines.filter((mine) => !baseId || mine.baseId === Number(baseId));

  const createWorkType = useAction(() => api.post('/admin/org/work-types', {
    code: workTypeCode.toUpperCase(),
    name: workTypeName,
    requiresContractPermission: true,
  }), {
    onSuccess: () => {
      setWorkTypeName('');
      setWorkTypeCode('');
      invalidate('org:work:');
    },
  });
  const createContract = useAction(() => api.post(`/org/bases/${baseId}/contracts`, {
    customerId: Number(customerId),
    statusId: activeContractStatus!.id,
    number: contractNumber,
    startsAt: contractStart,
    endsAt: contractEnd,
  }), {
    onSuccess: () => {
      setContractNumber('');
      invalidate('org:work:contracts:');
    },
  });
  const setPermission = useAction(() => api.put(
    addendumId
      ? `/org/contracts/${contractId}/addenda/${addendumId}/work-permissions`
      : `/org/contracts/${contractId}/work-permissions`,
    {
    workTypeId: Number(workTypeId),
    isAllowed: workPermission,
    },
  ), {
    onSuccess: () => setMessage('Разрешение для вида работ сохранено.'),
  });
  const assignBasis = useAction(() => api.post(`/org/wells/${wellId}/contract-bases`, {
    ...(addendumId ? { addendumId: Number(addendumId) } : { contractId: Number(contractId) }),
    startsAt: wellBasisStart,
    endsAt: wellBasisEnd || null,
  }), {
    onSuccess: () => { setMessage('Договорное основание закреплено за скважиной.'); invalidate(`org:work:wells:${mineId}`); },
  });
  const assignBasisBulk = useAction(() => api.post('/org/contract-bases/bulk', {
    wellIds: basisWellIds,
    basis: {
      ...(addendumId ? { addendumId: Number(addendumId) } : { contractId: Number(contractId) }),
      startsAt: wellBasisStart,
      endsAt: wellBasisEnd || null,
    },
  }), {
    onSuccess: () => {
      setMessage(`Договорное основание закреплено за ${basisWellIds.length} скважинами.`);
      setBasisWellIds([]);
      invalidate(`org:work:wells:${mineId}`);
    },
  });
  const recordWork = useAction(() => api.post('/org/work', {
    wellId: Number(wellId),
    ...(customerSiteWorkId ? { customerSiteWorkId: Number(customerSiteWorkId) } : {}),
    workTypeId: Number(workTypeId),
    performedAt,
    statusId: Number(workStatusId || defaultWorkStatus?.id),
    description: description || null,
  }), {
    onSuccess: () => {
      setMessage('Работа зарегистрирована.');
      setDescription('');
    },
  });

  const firstError = [
    basesQuery.error,
    minesQuery.error,
    customersQuery.error,
    workTypesQuery.error,
    workStatusesQuery.error,
    contractStatusesQuery.error,
    addendumStatusesQuery.error,
    selfQuery.error,
    contractsQuery.error,
    wellsQuery.error,
    customerSiteWorksQuery.error,
  ].find(Boolean);

  return <>
    <PageHeader title="Договоры и выполнение работ" subtitle="Заказчики, договорные основания, разрешённые виды и регистрация работ по скважинам" />
    {firstError && <Alert>{firstError}</Alert>}
    {message && <Alert kind="info">{message}</Alert>}
    {!canManageWork && <Alert kind="info">Раздел доступен менеджеру своей базы и администратору. Координатор работает только со своими проектами и командой.</Alert>}

    {canManageWork && isAdmin && <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Справочники</h2>
      <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 12 }} onSubmit={(event) => {
        event.preventDefault();
        createWorkType.run();
      }}>
        <TextField label="Новый вид работ" value={workTypeName} onChange={(event) => setWorkTypeName(event.target.value)} />
        <TextField label="Код" value={workTypeCode} onChange={(event) => setWorkTypeCode(event.target.value)} />
        <button className="btn" disabled={!workTypeName.trim() || !workTypeCode.trim() || createWorkType.pending}>Добавить вид работ</button>
      </form>
      <ActionError error={createWorkType.error} />
    </section>}

    {canManageWork && isAdmin && <section className="panel pad" style={{ marginBottom: 16 }}>
      <h2 className="section-title">Как начать работу с месторождениями</h2>
      <p className="muted">Создайте базу в разделе «Справочники → Базы», затем откройте «Работы и объекты → Месторождения и скважины». Там добавьте месторождение, скважины и назначьте координатора.</p>
    </section>}

    {canManageWork && <><section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Основной договор</h2>
      <form className="row wrap" style={{ alignItems: 'flex-end' }} onSubmit={(event) => {
        event.preventDefault();
        createContract.run();
      }}>
        <SelectField label="База" value={baseId} onChange={(event) => {
          setBaseId(event.target.value);
          setMineId('');
          setWellId('');
          setCustomerSiteWorkId('');
          setContractId('');
        }}>
          <option value="">Выберите базу</option>
          {bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}
        </SelectField>
        <SelectField label="Заказчик" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">Выберите заказчика</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </SelectField>
        <TextField label="Номер договора" value={contractNumber} onChange={(event) => setContractNumber(event.target.value)} />
        <TextField label="Действует с" type="date" value={contractStart} onChange={(event) => setContractStart(event.target.value)} />
        <TextField label="Действует по" type="date" value={contractEnd} onChange={(event) => setContractEnd(event.target.value)} />
        <button className="btn btn-primary" disabled={!baseId || !customerId || !contractNumber.trim() || !contractEnd || !activeContractStatus || createContract.pending}>Создать договор</button>
      </form>
      <ActionError error={createContract.error} />
      {contractsQuery.data && <>
        <div className="row wrap" style={{ alignItems: 'flex-end', marginTop: 16 }}>
          <SelectField label="Договор" value={contractId} onChange={(event) => {
            setContractId(event.target.value);
            setAddendumId('');
            setCustomerSiteWorkId('');
          }}>
            <option value="">Выберите договор</option>
            {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.number} · {contract.customer.name} ({contract.status.name})</option>)}
          </SelectField>
          <SelectField label="Дополнительное соглашение (необязательно)" value={addendumId} onChange={(event) => setAddendumId(event.target.value)}>
            <option value="">Основной договор</option>
            {availableAddenda.map((addendum) => <option key={addendum.id} value={addendum.id}>{addendum.number} · {addendum.status.name}</option>)}
          </SelectField>
        </div>
        {selectedContract && <>
          <ContractEditor
            contract={selectedContract}
            customers={customers}
            statuses={contractStatusesQuery.data ?? []}
            onSaved={() => { invalidate('org:work:contracts:'); setMessage('Договор сохранён.'); }}
          />
          {activeAddendumStatus && <AddendumCreator
            contractId={selectedContract.id}
            statusId={activeAddendumStatus.id}
            onCreated={() => invalidate('org:work:contracts:')}
          />}
        </>}
      </>}
    </section>

    <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Скважины и привязка договора</h2>
      <p className="muted">Чтобы один договор или допсоглашение покрывал несколько скважин, выберите нужные скважины ниже. Привязка применяется атомарно: при ошибке не сохраняется ни одна привязка.</p>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <SelectField label="Месторождение" value={mineId} onChange={(event) => {
          setMineId(event.target.value);
          setWellId('');
          setCustomerSiteWorkId('');
        }}>
          <option value="">Выберите месторождение</option>
          {sameBaseMines.map((mine) => <option key={mine.id} value={mine.id}>{mine.base.name} · {mine.name}</option>)}
        </SelectField>
        <SelectField label="Скважина" value={wellId} onChange={(event) => {
          setWellId(event.target.value);
          setCustomerSiteWorkId('');
        }}>
          <option value="">Выберите скважину</option>
          {wells.map((well) => <option key={well.id} value={well.id}>{well.name}{well.code ? ` · ${well.code}` : ''}</option>)}
        </SelectField>
        <TextField label="Основание с" type="date" value={wellBasisStart} onChange={(event) => setWellBasisStart(event.target.value)} />
        <TextField label="Основание по (пусто — без даты окончания)" type="date" value={wellBasisEnd} onChange={(event) => setWellBasisEnd(event.target.value)} />
        <button type="button" className="btn btn-primary" disabled={!wellId || !(addendumId || contractId) || assignBasis.pending} onClick={() => assignBasis.run()}>
          Привязать к выбранной скважине
        </button>
      </div>
      {wellId && <p className="muted small">Перед применением выберите выше договор или допсоглашение. Текущий выбор: {addendumId ? `допсоглашение ${availableAddenda.find((item) => String(item.id) === addendumId)?.number ?? ''}` : selectedContract ? `договор ${selectedContract.number}` : 'не выбран'}.</p>}
      {wells.length > 0 && <div className="stack tight" style={{ marginTop: 16 }}>
        <strong>Массовая привязка к скважинам месторождения</strong>
        {wells.map((well) => <label className="check-row" key={well.id}>
          <input type="checkbox" checked={basisWellIds.includes(well.id)} onChange={(event) => setBasisWellIds((current) => event.target.checked ? [...current, well.id] : current.filter((id) => id !== well.id))} />
          <span>{well.name}{well.code ? ` · ${well.code}` : ''}</span>
        </label>)}
        <button type="button" className="btn" disabled={!basisWellIds.length || !(addendumId || contractId) || assignBasisBulk.pending} onClick={() => {
          setMessage('');
          assignBasisBulk.run();
        }}>Применить к {basisWellIds.length || 'выбранным'} скважинам</button>
        <ActionError error={assignBasisBulk.error} />
      </div>}
      {wells.length > 0 && <div className="table-wrap" style={{ marginTop: 16 }}><table className="table"><thead><tr><th>Скважина</th><th>Действующее договорное основание</th></tr></thead><tbody>{wells.map((well) => <tr key={well.id}><td>{well.name}</td><td>{well.contractBases?.map((basis) => basis.contract?.number ?? basis.addendum?.number).join(', ') || 'Не привязано'}</td></tr>)}</tbody></table></div>}
      <ActionError error={assignBasis.error} />
    </section>

    <section className="panel" style={{ padding: 18 }}>
      <h2 className="section-title">Разрешение и фактическая работа</h2>
      <form className="row wrap" style={{ alignItems: 'flex-end' }} onSubmit={(event) => {
        event.preventDefault();
        setPermission.run();
      }}>
        <SelectField label="Вид работ" value={workTypeId} onChange={(event) => setWorkTypeId(event.target.value)}>
          <option value="">Выберите вид работ</option>
          {workTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </SelectField>
        {selectedWorkType?.requiresContractPermission && <SelectField label="Разрешить по договору" value={String(workPermission)} onChange={(event) => setWorkPermission(event.target.value === 'true')}>
          <option value="true">Разрешено</option>
          <option value="false">Запрещено</option>
        </SelectField>}
        <button className="btn" disabled={!contractId || !workTypeId || setPermission.pending}>Сохранить разрешение</button>
      </form>
      <ActionError error={setPermission.error} />

      <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 16 }} onSubmit={(event) => {
        event.preventDefault();
        setMessage('');
        recordWork.run();
      }}>
        <SelectField label="Скважина" value={wellId} onChange={(event) => {
          setWellId(event.target.value);
          setCustomerSiteWorkId('');
        }}>
          <option value="">Выберите скважину</option>
          {wells.map((well) => <option key={well.id} value={well.id}>{well.name}</option>)}
        </SelectField>
        <SelectField label="Работа на объекте заказчика" value={customerSiteWorkId} onChange={(event) => setCustomerSiteWorkId(event.target.value)}>
          <option value="">Не связывать с работой на объекте</option>
          {selectableCustomerSiteWorks.map((work) => <option key={work.id} value={work.id}>{work.name} · {work.customer.name} ({work.startsAt} – {work.expectedEndAt})</option>)}
        </SelectField>
        <SelectField label="Статус выполнения" value={workStatusId || String(defaultWorkStatus?.id ?? '')} onChange={(event) => setWorkStatusId(event.target.value)}>
          {(workStatusesQuery.data ?? []).map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
        </SelectField>
        <TextField label="Дата выполнения" type="date" value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} />
        <TextField label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button className="btn btn-primary" disabled={!wellId || !workTypeId || !(workStatusId || defaultWorkStatus?.id) || recordWork.pending}>Зарегистрировать работу</button>
      </form>
      <ActionError error={recordWork.error} />
    </section>
    </>}
  </>;
}

function ContractEditor({
  contract,
  customers,
  statuses,
  onSaved,
}: {
  contract: Contract;
  customers: Customer[];
  statuses: Status[];
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState(String(contract.customer.id));
  const [statusId, setStatusId] = useState(String(contract.status.id));
  const [number, setNumber] = useState(contract.number);
  const [startsAt, setStartsAt] = useState(contract.startsAt.slice(0, 10));
  const [endsAt, setEndsAt] = useState(contract.endsAt.slice(0, 10));
  const documentKey = `org:work:contract-documents:${contract.id}`;
  const documents = useQuery(documentKey, () => api.get<ContractDocument[]>(`/org/contracts/${contract.id}/documents`));
  const update = useAction(() => api.patch(`/org/contracts/${contract.id}`, {
    customerId: Number(customerId),
    statusId: Number(statusId),
    number: number.trim(),
    startsAt,
    endsAt,
  }), { onSuccess: onSaved });
  const upload = useAction((file: File) => api.upload<ContractDocument>(`/org/contracts/${contract.id}/documents`, file), {
    onSuccess: () => invalidate(documentKey),
  });
  const remove = useAction((id: number) => api.delete(`/org/contracts/${contract.id}/documents/${id}`), {
    onSuccess: () => invalidate(documentKey),
  });
  const download = useAction((document: ContractDocument) => api.blob(`/org/contracts/${contract.id}/documents/${document.id}`).then((blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.name;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }));
  const editableStatuses = statuses.filter((status) => status.isActive || status.id === contract.status.id);
  const editableCustomers = customers.some((customer) => customer.id === contract.customer.id)
    ? customers
    : [contract.customer, ...customers];

  return <section className="panel" style={{ padding: 14, marginTop: 12 }}>
    <h3 className="section-title">Карточка договора</h3>
    <form className="row wrap" style={{ alignItems: 'flex-end' }} onSubmit={(event) => { event.preventDefault(); update.run(); }}>
      <SelectField label="Заказчик" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
        {editableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{!customer.isActive ? ' (архив)' : ''}</option>)}
      </SelectField>
      <TextField label="Номер договора" value={number} onChange={(event) => setNumber(event.target.value)} />
      <TextField label="Действует с" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
      <TextField label="Действует по" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
      <SelectField label="Статус договора" value={statusId} onChange={(event) => setStatusId(event.target.value)}>
        {editableStatuses.map((status) => <option key={status.id} value={status.id}>{status.name}{!status.isActive ? ' (архив)' : ''}</option>)}
      </SelectField>
      <button className="btn btn-primary" disabled={update.pending || !number.trim() || !customerId || !statusId || !startsAt || endsAt < startsAt}>Сохранить договор</button>
    </form>
    <ActionError error={update.error} />
    <h4>Документы договора</h4>
    {documents.error && <Alert>{documents.error}</Alert>}
    <label className="btn">
      Загрузить документ (JPG, PNG, WebP или PDF, до 5 МБ)
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) upload.run(file);
        event.currentTarget.value = '';
      }} />
    </label>
    <ActionError error={upload.error} />
    {documents.data?.length
      ? <ul>{documents.data.map((document) => <li key={document.id}>
        {document.name} · <button type="button" className="btn btn-sm" disabled={download.pending} onClick={() => download.run(document)}>Скачать</button>
        <button type="button" className="btn btn-sm" disabled={remove.pending} onClick={() => remove.run(document.id)}>Удалить</button>
      </li>)}</ul>
      : <p className="muted small">Документы пока не загружены.</p>}
    <ActionError error={download.error} />
    <ActionError error={remove.error} />
  </section>;
}

function AddendumCreator({
  contractId,
  statusId,
  onCreated,
}: {
  contractId: number;
  statusId: number;
  onCreated: () => void;
}) {
  const [number, setNumber] = useState('');
  const [startsAt, setStartsAt] = useState(today());
  const [endsAt, setEndsAt] = useState('');
  const [description, setDescription] = useState('');
  const create = useAction(() => api.post(`/org/contracts/${contractId}/addenda`, {
    statusId,
    number,
    startsAt,
    endsAt,
    description,
  }), {
    onSuccess: () => {
      setNumber('');
      setDescription('');
      onCreated();
    },
  });
  return <div className="row wrap" style={{ alignItems: 'flex-end' }}>
    <TextField label="№ допсоглашения" value={number} onChange={(event) => setNumber(event.target.value)} />
    <TextField label="С" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
    <TextField label="По" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
    <TextField label="Описание изменений" value={description} onChange={(event) => setDescription(event.target.value)} />
    <button type="button" className="btn" disabled={!number.trim() || !endsAt || !description.trim() || create.pending} onClick={() => create.run()}>
      Добавить допсоглашение
    </button>
    <ActionError error={create.error} />
  </div>;
}
