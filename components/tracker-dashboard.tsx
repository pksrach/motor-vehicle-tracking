'use client'

import { useEffect, useLayoutEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { plural } from '@lingui/core/macro'
import { useLingui, Trans } from '@lingui/react/macro'
import { useLanguage } from '@/components/i18n-provider'
import { LanguageSwitcher } from '@/components/language-switcher'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  CarFront,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  FileText,
  Gauge,
  PenLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import {
  createVehicle,
  deleteVehicle,
  removeMaintenance,
  saveMaintenance,
  updateVehicle,
} from '@/app/actions/tracker'
import { DashboardLoading } from '@/components/dashboard-loading'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type Item = {
  id: string
  maintenanceRecordId: string
  remark: string
  quantity: number
  priceUsd: string
  priceKhr: string
}
type Record = { id: string; serviceDate: string; odometerKm: number | null; items: Item[] }
type Vehicle = {
  id: string
  name: string
  plateNumber: string | null
  notes: string | null
  records: Record[]
}
type Confirmation =
  { type: 'record'; recordId: string } | { type: 'vehicle'; vehicleId: string; vehicleName: string }

const formatLocale = (locale: 'en' | 'km') => (locale === 'km' ? 'km-KH' : 'en-US')
const limitIntegerInput = (value: string) => (/^\d*$/.test(value) ? value : null)
const limitDecimalInput = (value: string) => {
  if (!/^\d*\.?\d*$/.test(value)) return null
  const [whole, fraction] = value.split('.')
  return fraction === undefined ? whole : `${whole}.${fraction.slice(0, 3)}`
}
const isValidAmount = (value: string, max: number) => {
  const amount = Number(value)
  return (
    Number.isFinite(amount) && amount >= 0 && amount <= max && Number(amount.toFixed(3)) === amount
  )
}
const isValidQuantity = (value: string) => {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 999999999
}
const usd = (value: number, locale: 'en' | 'km') =>
  new Intl.NumberFormat(formatLocale(locale), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 3,
  }).format(value)
const khr = (value: number, locale: 'en' | 'km') =>
  `${new Intl.NumberFormat(formatLocale(locale), { maximumFractionDigits: 3 }).format(value)} ៛`
const dateLabel = (value: string, locale: 'en' | 'km') =>
  new Intl.DateTimeFormat(locale === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
const totalsFor = (record: Record) =>
  record.items.reduce(
    (totals, item) => ({
      usd: totals.usd + item.quantity * Number(item.priceUsd),
      khr: totals.khr + item.quantity * Number(item.priceKhr),
    }),
    { usd: 0, khr: 0 },
  )
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function TrackerDashboard({
  vehicles: initialVehicles,
  userId,
  userName,
}: {
  vehicles: Vehicle[]
  userId: string
  userName: string
}) {
  const { t } = useLingui()
  const { locale } = useLanguage()
  const errorTranslations: { [message: string]: string } = {
    Unauthorized: t`Unauthorized`,
    'Vehicle not found or access denied': t`Vehicle not found or access denied`,
    'Invalid service date': t`Invalid service date`,
    'Record not found or access denied': t`Record not found or access denied`,
  }
  const [vehicles] = useState(initialVehicles)
  const [selectedId, setSelectedId] = useState(initialVehicles[0]?.id ?? '')
  const [selectionReady, setSelectionReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const storageKey = `motive:selectedVehicle:${userId}`

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentTime(new Date()), 0)
    return () => window.clearTimeout(timer)
  }, [])
  useIsomorphicLayoutEffect(() => {
    try {
      const savedId = window.localStorage.getItem(storageKey)
      if (savedId && initialVehicles.some((vehicle) => vehicle.id === savedId))
        setSelectedId(savedId)
      else if (savedId) window.localStorage.removeItem(storageKey)
    } catch {
      setNotice(
        t`Error: Browser storage is unavailable, so the selected vehicle could not be restored.`,
      )
      setNoticeIsError(true)
    } finally {
      setSelectionReady(true)
    }
  }, [initialVehicles, storageKey])
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<'vehicle' | 'service' | null>(null)
  const [editing, setEditing] = useState<Record | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'garage' | 'timeline'>('overview')
  const [pending, startTransition] = useTransition()
  const displayName = userName === 'Driver' ? t`Driver` : userName
  const vehicleName = confirmation?.type === 'vehicle' ? confirmation.vehicleName : ''
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0]
  const records = useMemo(() => selected?.records ?? [], [selected])
  const totalVisits = records.length
  const totals = records.reduce(
    (sum, record) => {
      const next = totalsFor(record)
      return { usd: sum.usd + next.usd, khr: sum.khr + next.khr }
    },
    { usd: 0, khr: 0 },
  )
  const filtered = useMemo(
    () =>
      records.filter((record) =>
        record.items.some((item) => item.remark.toLowerCase().includes(query.toLowerCase())),
      ),
    [records, query],
  )
  const latest = records[0]
  const newestDate = latest ? new Date(latest.serviceDate) : null
  const daysSince =
    newestDate && currentTime
      ? Math.max(0, Math.floor((currentTime.getTime() - newestDate.getTime()) / 86400000))
      : null
  const greeting = currentTime
    ? currentTime.getHours() < 12
      ? t`morning`
      : currentTime.getHours() < 18
        ? t`afternoon`
        : t`evening`
    : null
  const name = displayName.split(' ')[0]
  const recordedVisits = (count: number) =>
    t`${plural(count, { one: '# recorded visit', other: '# recorded visits' })}`
  const vehicleVisits = (count: number) => t`${plural(count, { one: 'visit', other: 'visits' })}`
  const daysAgo = (count: number) => t`${count}d ago`

  function selectVehicle(id: string) {
    setSelectedId(id)
    try {
      window.localStorage.setItem(storageKey, id)
      setNotice('')
      setNoticeIsError(false)
    } catch {
      setNotice(
        t`Error: Browser storage is unavailable, so this selection will not be remembered after refresh.`,
      )
      setNoticeIsError(true)
    }
  }

  function run(action: () => Promise<void>, success: string) {
    setNotice('')
    setNoticeIsError(false)
    startTransition(async () => {
      try {
        await action()
        setNotice(success)
        setNoticeIsError(false)
        window.location.reload()
      } catch (error) {
        setNotice(
          error instanceof Error
            ? (errorTranslations[error.message] ?? error.message)
            : t`Something went wrong. Please try again.`,
        )
        setNoticeIsError(true)
      }
    })
  }

  function confirmPendingAction() {
    if (!confirmation) return
    const target = confirmation
    setConfirmation(null)
    if (target.type === 'record')
      run(() => removeMaintenance(target.recordId), t`Service visit deleted.`)
    else run(() => deleteVehicle(target.vehicleId), t`Vehicle removed.`)
  }

  if (!selectionReady) return <DashboardLoading />

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Gauge size={19} />
          </span>
          <span>
            motive<span className="brand-dot">.</span>
            <small>VEHICLE CARE</small>
          </span>
        </Link>
        <div className="nav-label">{t`WORKSPACE`}</div>
        <a
          className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
          href="#overview"
          aria-current={activeSection === 'overview' ? 'location' : undefined}
          onClick={() => setActiveSection('overview')}
        >
          <Activity size={17} /> {t`Overview`}
        </a>
        <a
          className={`nav-item ${activeSection === 'garage' ? 'active' : ''}`}
          href="#garage"
          aria-current={activeSection === 'garage' ? 'location' : undefined}
          onClick={() => setActiveSection('garage')}
        >
          <CarFront size={17} /> {t`My garage`} <span className="nav-count">{vehicles.length}</span>
        </a>
        <a
          className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`}
          href="#timeline"
          aria-current={activeSection === 'timeline' ? 'location' : undefined}
          onClick={() => setActiveSection('timeline')}
        >
          <Clock3 size={17} /> {t`Service history`}
        </a>
        <div className="sidebar-spacer" />
        <div className="secure-note">
          <ShieldCheck size={16} />
          <span>
            {t`Your records are private`}
            <br />
            {t`and secured to your account.`}
          </span>
        </div>
        <button className="account" onClick={() => signOut({ callbackUrl: '/login' })}>
          <span className="avatar">{displayName.trim().charAt(0).toUpperCase()}</span>
          <span className="account-name">
            {displayName}
            <small>{t`Personal workspace`}</small>
          </span>
          <ChevronDown size={15} />
        </button>
      </aside>

      <main className="main" id="overview">
        <header className="topbar">
          <div className="crumb">
            {t`Workspace`} <span>/</span>{' '}
            {activeSection === 'garage'
              ? t`My garage`
              : activeSection === 'timeline'
                ? t`Service history`
                : t`Overview`}
          </div>
          <div className="top-actions">
            <span className="live-dot">
              <i /> {t`All systems ready`}
            </span>
            <LanguageSwitcher />
            <button className="icon-button" aria-label={t`Settings`}>
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <section className="welcome">
          <div>
            <div className="eyebrow">
              <Sparkles size={13} /> {t`YOUR GARAGE, IN GOOD ORDER`}
            </div>
            <h1>{greeting ? t`Good ${greeting}, ${name}.` : t`Welcome, ${name}.`}</h1>
            <p>{t`Stay ahead of every mile. Your vehicle care, all in one place.`}</p>
          </div>
          <button
            className="button primary"
            onClick={() => setDialog('service')}
            disabled={!selected}
          >
            <CirclePlus size={17} /> {t`Log a service`}
          </button>
        </section>

        {notice && (
          <div className={`notice ${noticeIsError ? 'error' : ''}`} role="status">
            {notice}
          </div>
        )}
        <section className="stat-grid" aria-label={t`Maintenance summary`}>
          <Stat
            icon={<Wrench size={17} />}
            label={t`SERVICE VISITS`}
            value={String(totalVisits).padStart(2, '0')}
            note={totalVisits ? recordedVisits(totalVisits) : t`Start your service history`}
            accent="amber"
          />
          <Stat
            icon={<ArrowUpRight size={17} />}
            label={t`TOTAL SPENT · USD`}
            value={usd(totals.usd, locale)}
            note={t`Across all service visits`}
            accent="green"
          />
          <Stat
            icon={<Activity size={17} />}
            label={t`TOTAL SPENT · KHR`}
            value={khr(totals.khr, locale)}
            note={t`Cambodian riel`}
            accent="blue"
          />
          <Stat
            icon={<Clock3 size={17} />}
            label={t`LAST SERVICE`}
            value={latest && daysSince !== null ? daysAgo(daysSince) : '—'}
            note={latest ? dateLabel(latest.serviceDate, locale) : t`No visits yet`}
            accent="violet"
          />
        </section>

        <section className="content-grid">
          <div className="primary-column">
            <div className="section-heading" id="garage">
              <div>
                <div className="eyebrow">{t`YOUR VEHICLES`}</div>
                <h2>
                  <Trans>Garage</Trans>{' '}
                  <span className="subcount">{vehicles.length.toString().padStart(2, '0')}</span>
                </h2>
              </div>
              <button
                className="button quiet"
                onClick={() => {
                  setEditingVehicle(null)
                  setDialog('vehicle')
                }}
              >
                <CirclePlus size={16} /> {t`Add Motor Vehicle`}
              </button>
            </div>
            {vehicles.length ? (
              <div className="vehicle-list">
                {vehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    className={`vehicle-card ${vehicle.id === selected?.id ? 'selected' : ''}`}
                    onClick={() => selectVehicle(vehicle.id)}
                    aria-pressed={vehicle.id === selected?.id}
                  >
                    <span className="vehicle-icon">
                      {vehicle.name.toLowerCase().includes('motor') ||
                      vehicle.name.toLowerCase().includes('bike') ? (
                        <Bike size={20} />
                      ) : (
                        <CarFront size={21} />
                      )}
                    </span>
                    <span className="vehicle-info">
                      <strong>{vehicle.name}</strong>
                      <small>
                        {vehicle.plateNumber || t`No plate number`} <i /> {vehicle.records.length}{' '}
                        {vehicleVisits(vehicle.records.length)}
                      </small>
                    </span>
                    <span className="vehicle-select">
                      {vehicle.id === selected?.id ? (
                        <Check size={15} />
                      ) : (
                        <ArrowDownRight size={15} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-garage">
                <div className="empty-icon">
                  <CarFront size={23} />
                </div>
                <strong>{t`Your garage is ready`}</strong>
                <span>{t`Add your first vehicle to start tracking its care.`}</span>
                <button
                  className="button primary"
                  onClick={() => {
                    setEditingVehicle(null)
                    setDialog('vehicle')
                  }}
                >
                  <CirclePlus size={16} /> {t`Add your first vehicle`}
                </button>
              </div>
            )}

            <div className="section-heading history-heading" id="timeline">
              <div>
                <div className="eyebrow">{t`THE COMPLETE PICTURE`}</div>
                <h2>{t`Service history`}</h2>
              </div>
              <div className="history-actions">
                <label className="search-field">
                  <Search size={15} />
                  <input
                    aria-label={t`Filter service items`}
                    placeholder={t`Find a part or service`}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {selected && (
                  <Link
                    className="export-button"
                    href={`/vehicles/${selected.id}/print`}
                    target="_blank"
                  >
                    <FileText size={15} /> {t`Report`}
                  </Link>
                )}
              </div>
            </div>

            {!selected ? (
              <div className="empty-history">
                <div className="empty-icon">
                  <Wrench size={22} />
                </div>
                <strong>{t`Your maintenance timeline starts here`}</strong>
                <span>{t`Add a vehicle, then log each service visit and its parts.`}</span>
              </div>
            ) : filtered.length ? (
              <div className="timeline">
                {filtered.map((record, index) => {
                  const sum = totalsFor(record)
                  return (
                    <article className="timeline-row" key={record.id}>
                      <div className="timeline-rail">
                        <span className="timeline-node">
                          {index === 0 ? <span className="node-core" /> : null}
                        </span>
                      </div>
                      <div className="record-card">
                        <header className="record-head">
                          <div>
                            <span className="record-date">
                              {dateLabel(record.serviceDate, locale)}
                            </span>
                            <span className="record-meta">
                              {record.odometerKm
                                ? `${record.odometerKm.toLocaleString()} km`
                                : t`Service visit`}
                              {index === 0 ? <b className="latest-tag">{t`LATEST`}</b> : null}
                            </span>
                          </div>
                          <div className="record-controls">
                            <button
                              aria-label={t`Edit service record`}
                              onClick={() => {
                                setEditing(record)
                                setDialog('service')
                              }}
                            >
                              <Settings2 size={15} />
                            </button>
                            <button
                              aria-label={t`Delete service record`}
                              onClick={() =>
                                setConfirmation({ type: 'record', recordId: record.id })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </header>
                        <div className="item-list">
                          {record.items.map((item) => (
                            <div className="service-item" key={item.id}>
                              <span className="item-check">
                                <Check size={12} />
                              </span>
                              <span className="item-name">
                                {item.remark} × {item.quantity}
                              </span>
                              <span className="item-price">
                                {usd(item.quantity * Number(item.priceUsd), locale)}
                              </span>
                              <span className="item-price khr-price">
                                {khr(item.quantity * Number(item.priceKhr), locale)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <footer className="record-total">
                          <span>{t`VISIT TOTAL`}</span>
                          <strong>{usd(sum.usd, locale)}</strong>
                          <strong>{khr(sum.khr, locale)}</strong>
                        </footer>
                      </div>
                    </article>
                  )
                })}
                <div className="timeline-end">{t`↑  CHRONOLOGICAL PROGRESSION`}</div>
              </div>
            ) : (
              <div className="empty-history">
                <div className="empty-icon">
                  <Search size={21} />
                </div>
                <strong>{query ? t`No matching service items` : t`No service visits yet`}</strong>
                <span>
                  {query
                    ? t`Try another part name or clear your search.`
                    : t`Your maintenance entries will appear here.`}
                </span>
                {!query && (
                  <button className="text-button" onClick={() => setDialog('service')}>
                    {t`Add the first service record`} <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <aside className="insight-column">
            <div className="insight-card focus-card">
              <div className="insight-top">
                <span className="insight-icon">
                  <Gauge size={17} />
                </span>
                <span className="insight-kicker">{t`CURRENT VEHICLE`}</span>
              </div>
              {selected ? (
                <>
                  <h3>{selected.name}</h3>
                  <div className="plate-chip">{selected.plateNumber || t`PLATE NOT ADDED`}</div>
                  <div className="insight-divider" />
                  <div className="insight-data">
                    <span>{t`Visits tracked`}</span>
                    <strong>{String(selected.records.length).padStart(2, '0')}</strong>
                  </div>
                  <div className="insight-data">
                    <span>{t`Last service`}</span>
                    <strong>{latest ? dateLabel(latest.serviceDate, locale) : '—'}</strong>
                  </div>
                  <div className="insight-data">
                    <span>{t`Lifetime spend`}</span>
                    <strong>{usd(totals.usd, locale)}</strong>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditingVehicle(selected)
                      setDialog('vehicle')
                    }}
                  >
                    <PenLine size={14} /> {t`Edit vehicle details`}
                  </button>
                  <button
                    className="remove-vehicle"
                    onClick={() =>
                      setConfirmation({
                        type: 'vehicle',
                        vehicleId: selected.id,
                        vehicleName: selected.name,
                      })
                    }
                  >
                    <Trash2 size={14} /> {t`Remove vehicle`}
                  </button>
                </>
              ) : (
                <p className="muted">{t`Choose a vehicle to see its details.`}</p>
              )}
            </div>
            <div className="tip-card">
              <div className="tip-icon">
                <Sparkles size={16} />
              </div>
              <span className="insight-kicker">{t`A LITTLE HEAD START`}</span>
              <h3>
                {t`Small checks.`}
                <br />
                {t`Longer journeys.`}
              </h3>
              <p>
                {t`Keep service dates and mileage up to date to spot patterns in your vehicle care.`}
              </p>
            </div>
            <div className="privacy-line">
              <ShieldCheck size={15} />
              <span>{t`Private by design. Your records belong to your account.`}</span>
            </div>
          </aside>
        </section>
      </main>

      {dialog === 'vehicle' && (
        <VehicleDialog
          initial={editingVehicle}
          busy={pending}
          onClose={() => {
            setDialog(null)
            setEditingVehicle(null)
          }}
          onSave={(values) =>
            run(
              async () => {
                if (editingVehicle) await updateVehicle(editingVehicle.id, values)
                else await createVehicle(values)
              },
              editingVehicle ? t`Vehicle details updated.` : t`Vehicle added.`,
            )
          }
        />
      )}
      {dialog === 'service' && selected && (
        <ServiceDialog
          vehicle={selected}
          initial={editing}
          busy={pending}
          onClose={() => {
            setDialog(null)
            setEditing(null)
          }}
          onSave={(values) =>
            run(
              async () => {
                await saveMaintenance(values, editing?.id)
              },
              editing ? t`Service visit updated.` : t`Service visit saved.`,
            )
          }
        />
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation.type === 'record' ? t`Delete service visit?` : t`Remove vehicle?`}
          description={
            confirmation.type === 'record'
              ? t`Delete this service visit and its line items?`
              : t`Remove ${vehicleName} and all its service history?`
          }
          confirmLabel={confirmation.type === 'record' ? t`Delete visit` : t`Remove vehicle`}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmPendingAction}
        />
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  note: string
  accent: string
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${accent}`}>{icon}</span>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </article>
  )
}

function VehicleDialog({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial: Vehicle | null
  busy: boolean
  onClose: () => void
  onSave: (value: { name: string; plateNumber?: string; notes?: string }) => void
}) {
  const { t } = useLingui()
  const [name, setName] = useState(initial?.name ?? '')
  const [plateNumber, setPlate] = useState(initial?.plateNumber ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const isEditing = Boolean(initial)
  return (
    <Modal
      title={isEditing ? t`Edit vehicle details` : t`Add a vehicle`}
      subtitle={
        isEditing
          ? t`Update this vehicle’s name, plate number, or notes.`
          : t`Give your vehicle a name you’ll recognize.`
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave({ name, plateNumber, notes })
        }}
      >
        <label className="form-label">
          {t`Vehicle name`}
          <input
            autoFocus
            required
            minLength={2}
            maxLength={80}
            placeholder={t`e.g. Honda Dream 2017`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="form-label">
          {t`Plate number`} <span>{t`OPTIONAL`}</span>
          <input
            maxLength={24}
            placeholder={t`e.g. 2AB-1234`}
            value={plateNumber}
            onChange={(event) => setPlate(event.target.value)}
          />
        </label>
        <label className="form-label">
          {t`Notes`} <span>{t`OPTIONAL`}</span>
          <textarea
            maxLength={500}
            rows={3}
            placeholder={t`Anything useful to remember`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button quiet" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button className="button primary" disabled={busy}>
            <CirclePlus size={15} /> {isEditing ? t`Save changes` : t`Save vehicle`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ServiceDialog({
  vehicle,
  initial,
  busy,
  onClose,
  onSave,
}: {
  vehicle: Vehicle
  initial: Record | null
  busy: boolean
  onClose: () => void
  onSave: (value: {
    vehicleId: string
    serviceDate: string
    odometerKm?: number
    items: { remark: string; quantity: number; priceUsd: number; priceKhr: number }[]
  }) => void
}) {
  const { t } = useLingui()
  const { locale } = useLanguage()
  const [serviceDate, setDate] = useState(
    initial ? initial.serviceDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [odometerKm, setOdometer] = useState(initial?.odometerKm?.toString() ?? '')
  const [items, setItems] = useState(
    initial?.items.map((item) => ({
      remark: item.remark,
      quantity: item.quantity,
      priceUsd: item.priceUsd,
      priceKhr: item.priceKhr,
    })) ?? [],
  )
  const [draftRemark, setDraftRemark] = useState('')
  const [draftQuantity, setDraftQuantity] = useState('1')
  const [draftPriceUsd, setDraftPriceUsd] = useState('0')
  const [draftPriceKhr, setDraftPriceKhr] = useState('0')
  const subtotalUsd = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.priceUsd || 0),
    0,
  )
  const subtotalKhr = items.reduce(
    (sum, item) => sum + item.quantity * Number(item.priceKhr || 0),
    0,
  )
  function addItem() {
    const quantity = Number(draftQuantity)
    const priceUsd = Number(draftPriceUsd || 0)
    const priceKhr = Number(draftPriceKhr || 0)
    if (
      !draftRemark.trim() ||
      !isValidQuantity(draftQuantity) ||
      !isValidAmount(draftPriceUsd, 99999999.999) ||
      !isValidAmount(draftPriceKhr, 99999999999999.999)
    ) {
      return
    }
    setItems((current) => [
      ...current,
      {
        remark: draftRemark.trim(),
        quantity,
        priceUsd: String(priceUsd),
        priceKhr: String(priceKhr),
      },
    ])
    setDraftRemark('')
    setDraftQuantity('1')
    setDraftPriceUsd('0')
    setDraftPriceKhr('0')
  }
  return (
    <Modal
      title={initial ? t`Edit service visit` : t`Log a service`}
      subtitle={t`Record the visit and the work completed.`}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave({
            vehicleId: vehicle.id,
            serviceDate,
            odometerKm: odometerKm ? Number(odometerKm) : undefined,
            items: items.map((item) => ({
              remark: item.remark,
              quantity: item.quantity,
              priceUsd: Number(item.priceUsd || 0),
              priceKhr: Number(item.priceKhr || 0),
            })),
          })
        }}
      >
        <div className="form-row">
          <label className="form-label">
            {t`Service date`}
            <input
              type="date"
              required
              value={serviceDate}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="form-label">
            <span className="form-label-heading">
              {t`Odometer`} <span>{t`KM`}</span>
            </span>
            <input
              type="number"
              min="0"
              placeholder={t`Optional`}
              value={odometerKm}
              onChange={(event) => setOdometer(event.target.value)}
            />
          </label>
        </div>
        <div className="line-items-title">
          <strong>{t`Work & parts`}</strong>
        </div>
        <div className="item-entry-form">
          <label className="form-label item-entry-remark">
            {t`Remark`}
            <input
              maxLength={160}
              placeholder={t`e.g. Change engine oil`}
              value={draftRemark}
              onChange={(event) => setDraftRemark(event.target.value)}
            />
          </label>
          <label className="form-label">
            {t`Quantity`}
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={draftQuantity}
              onChange={(event) => {
                const value = limitIntegerInput(event.target.value)
                if (value !== null) setDraftQuantity(value)
              }}
            />
          </label>
          <label className="form-label">
            {t`Price`} USD ($)
            <input
              type="text"
              inputMode="decimal"
              maxLength={12}
              value={draftPriceUsd}
              onChange={(event) => {
                const value = limitDecimalInput(event.target.value)
                if (value !== null) setDraftPriceUsd(value)
              }}
            />
          </label>
          <label className="form-label">
            {t`Price`} KHR (៛)
            <input
              type="text"
              inputMode="decimal"
              maxLength={18}
              value={draftPriceKhr}
              onChange={(event) => {
                const value = limitDecimalInput(event.target.value)
                if (value !== null) setDraftPriceKhr(value)
              }}
            />
          </label>
          <button
            type="button"
            className="button quiet item-add-button"
            onClick={addItem}
            disabled={
              !draftRemark.trim() ||
              !isValidQuantity(draftQuantity) ||
              !isValidAmount(draftPriceUsd, 99999999.999) ||
              !isValidAmount(draftPriceKhr, 99999999999999.999) ||
              items.length >= 30
            }
          >
            <CirclePlus size={14} /> {t`Add item`}
          </button>
        </div>
        <div className="line-items-table-wrap">
          <table className="line-items-table">
            <thead>
              <tr>
                <th scope="col">{t`Remark`}</th>
                <th scope="col">{t`Quantity`}</th>
                <th scope="col">{t`Price`} USD ($)</th>
                <th scope="col">{t`Price`} KHR (៛)</th>
                <th scope="col">{t`Subtotal`} USD ($)</th>
                <th scope="col">{t`Subtotal`} KHR (៛)</th>
                <th scope="col">
                  <span className="sr-only">{t`Actions`}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="empty-items" colSpan={7}>{t`No work or parts added yet`}</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={`${item.remark}-${index}`}>
                    <td>{item.remark}</td>
                    <td>{item.quantity}</td>
                    <td>{usd(Number(item.priceUsd), locale)}</td>
                    <td>{khr(Number(item.priceKhr), locale)}</td>
                    <td>{usd(item.quantity * Number(item.priceUsd), locale)}</td>
                    <td>{khr(item.quantity * Number(item.priceKhr), locale)}</td>
                    <td>
                      <button
                        type="button"
                        className="remove-line"
                        aria-label={t`Remove line item`}
                        onClick={() =>
                          setItems((current) => current.filter((_, row) => row !== index))
                        }
                      >
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="subtotal">
          <span>{t`VISIT SUBTOTAL`}</span>
          <strong>
            {usd(subtotalUsd, locale)} <i /> {khr(subtotalKhr, locale)}
          </strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="button quiet" onClick={onClose}>
            {t`Cancel`}
          </button>
          <button className="button primary" disabled={busy || items.length === 0}>
            <Check size={15} /> {initial ? t`Save changes` : t`Save service`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  wide = false,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  const { t } = useLingui()
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" aria-label={t`Close dialog`} onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
