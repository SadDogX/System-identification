import { useState } from 'react';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { ActionError } from '../../widgets/feedback/ActionError';

interface Base { id: number; name: string; code: string | null }
interface Mine { id: number; name: string; baseId: number; base: Base }
interface Well { id: number; name: string; code: string | null; contractBases?: { contract: { number: string } | null; addendum: { number: string } | null }[] }
interface Customer { id: number; name: string; code: string | null }
interface WorkType { id: number; name: string; code: string; requiresContractPermission: boolean }
interface Status { id: number; code: string; name: string; allowsWork?: boolean }
interface Contract {
  id: number;
  number: string;
  startsAt: string;
  endsAt: string;
  customer: Customer;
  status: Status;
  addenda: { id: number; number: string; startsAt: string; endsAt: string; status: Status }[];
}
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
  const isAdmin = user.role === 'ADMIN';
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
  const [workStatusId, setWorkStatusId] = useState('');
  const [performedAt, setPerformedAt] = useState(today());
  const [contractStart, setContractStart] = useState(today());
  const [contractEnd, setContractEnd] = useState('');
  const [workPermission, setWorkPermission] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
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
  const bases = basesQuery.data ?? [];
  const mines = minesQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const workTypes = workTypesQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const wells = wellsQuery.data ?? [];
  const selectedContract = contracts.find((contract) => String(contract.id) === contractId);
  const selectedWorkType = workTypes.find((type) => String(type.id) === workTypeId);
  const availableAddenda = selectedContract?.addenda ?? [];
  const activeContractStatus = (contractStatusesQuery.data ?? []).find((status) => status.code === 'ACTIVE');
  const activeAddendumStatus = (addendumStatusesQuery.data ?? []).find((status) => status.code === 'ACTIVE');
  const defaultWorkStatus = (workStatusesQuery.data ?? []).find((status) => status.code === 'COMPLETED');
  const sameBaseMines = mines.filter((mine) => !baseId || mine.baseId === Number(baseId));

  const createCustomer = useAction(() => api.post('/org/customers', { name: customerName, code: customerCode || null }), {
    onSuccess: () => {
      setCustomerName('');
      setCustomerCode('');
      invalidate('org:work:');
    },
  });
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
  const recordWork = useAction(() => api.post('/org/work', {
    wellId: Number(wellId),
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
  ].find(Boolean);

  return <>
    <PageHeader title="Договоры и выполнение работ" subtitle="Заказчики, договорные основания, разрешённые виды и регистрация работ по скважинам" />
    {firstError && <Alert>{firstError}</Alert>}
    {message && <Alert kind="info">{message}</Alert>}
    {!canManageWork && <Alert kind="info">Раздел доступен менеджеру своей базы и администратору. Координатор работает только со своими проектами и командой.</Alert>}

    {canManageWork && isAdmin && <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Справочники</h2>
      <form className="row wrap" style={{ alignItems: 'flex-end' }} onSubmit={(event) => {
        event.preventDefault();
        createCustomer.run();
      }}>
        <TextField label="Новый заказчик" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        <TextField label="Код заказчика" value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} />
        <button className="btn" disabled={!customerName.trim() || createCustomer.pending}>Добавить заказчика</button>
      </form>
      <ActionError error={createCustomer.error} />
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
          }}>
            <option value="">Выберите договор</option>
            {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.number} · {contract.customer.name} ({contract.status.name})</option>)}
          </SelectField>
          <SelectField label="Дополнительное соглашение (необязательно)" value={addendumId} onChange={(event) => setAddendumId(event.target.value)}>
            <option value="">Основной договор</option>
            {availableAddenda.map((addendum) => <option key={addendum.id} value={addendum.id}>{addendum.number} · {addendum.status.name}</option>)}
          </SelectField>
        </div>
        {selectedContract && <div className="row wrap" style={{ alignItems: 'flex-end', marginTop: 12 }}>
          <span className="muted">Договор действует {selectedContract.startsAt.slice(0, 10)}—{selectedContract.endsAt.slice(0, 10)}</span>
          {activeAddendumStatus && <AddendumCreator
            contractId={selectedContract.id}
            statusId={activeAddendumStatus.id}
            onCreated={() => invalidate('org:work:contracts:')}
          />}
        </div>}
      </>}
    </section>

    <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Скважины и привязка договора</h2>
      <p className="muted">Чтобы один договор покрывал несколько скважин, выберите нужные скважины ниже и примените договорное основание ко всем за один раз.</p>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <SelectField label="Месторождение" value={mineId} onChange={(event) => {
          setMineId(event.target.value);
          setWellId('');
        }}>
          <option value="">Выберите месторождение</option>
          {sameBaseMines.map((mine) => <option key={mine.id} value={mine.id}>{mine.base.name} · {mine.name}</option>)}
        </SelectField>
        <SelectField label="Скважина" value={wellId} onChange={(event) => setWellId(event.target.value)}>
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
        <button type="button" className="btn" disabled={!basisWellIds.length || !(addendumId || contractId) || assignBasis.pending} onClick={async () => {
          setMessage('');
          for (const id of basisWellIds) {
            const ok = await api.post(`/org/wells/${id}/contract-bases`, {
              ...(addendumId ? { addendumId: Number(addendumId) } : { contractId: Number(contractId) }),
              startsAt: wellBasisStart,
              endsAt: wellBasisEnd || null,
            }).then(() => true).catch((error) => { setMessage(`Привязка остановлена на скважине ${id}: ${errorMessage(error)}. Ранее выполненные привязки сохранены.`); return false; });
            if (!ok) { invalidate(`org:work:wells:${mineId}`); return; }
          }
          setMessage(`Договорное основание закреплено за ${basisWellIds.length} скважинами.`);
          setBasisWellIds([]);
          invalidate(`org:work:wells:${mineId}`);
        }}>Применить к {basisWellIds.length || 'выбранным'} скважинам</button>
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
        <SelectField label="Скважина" value={wellId} onChange={(event) => setWellId(event.target.value)}>
          <option value="">Выберите скважину</option>
          {wells.map((well) => <option key={well.id} value={well.id}>{well.name}</option>)}
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
