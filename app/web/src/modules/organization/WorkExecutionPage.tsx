import { useState } from 'react';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField } from '@app/shared/ui';

interface Base { id: number; name: string; code: string | null }
interface Mine { id: number; name: string; baseId: number; base: Base }
interface Well { id: number; name: string; code: string | null }
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
    onSuccess: () => setMessage('Договорное основание закреплено за скважиной.'),
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
      {Boolean(createCustomer.error) && <Alert>{errorMessage(createCustomer.error)}</Alert>}
      <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 12 }} onSubmit={(event) => {
        event.preventDefault();
        createWorkType.run();
      }}>
        <TextField label="Новый вид работ" value={workTypeName} onChange={(event) => setWorkTypeName(event.target.value)} />
        <TextField label="Код" value={workTypeCode} onChange={(event) => setWorkTypeCode(event.target.value)} />
        <button className="btn" disabled={!workTypeName.trim() || !workTypeCode.trim() || createWorkType.pending}>Добавить вид работ</button>
      </form>
      {Boolean(createWorkType.error) && <Alert>{errorMessage(createWorkType.error)}</Alert>}
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
      {Boolean(createContract.error) && <Alert>{errorMessage(createContract.error)}</Alert>}
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
      <h2 className="section-title">Скважины и договорное основание</h2>
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
        <button type="button" className="btn" disabled={!wellId || !contractId || assignBasis.pending} onClick={() => assignBasis.run()}>
          Закрепить основание
        </button>
      </div>
      {Boolean(assignBasis.error) && <Alert>{errorMessage(assignBasis.error)}</Alert>}
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
      {Boolean(setPermission.error) && <Alert>{errorMessage(setPermission.error)}</Alert>}

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
      {Boolean(recordWork.error) && <Alert>{errorMessage(recordWork.error)}</Alert>}
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
    {Boolean(create.error) && <Alert>{errorMessage(create.error)}</Alert>}
  </div>;
}
