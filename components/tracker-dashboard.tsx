'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
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
  Edit,
  FileText,
  Gauge,
  Pencil,
  PenLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import {
  createMaintenanceRemark,
  createVehicle,
  deleteVehicle,
  getVehicleServiceHistory,
  removeMaintenance,
  searchMaintenanceRemarks,
  saveMaintenance,
  updateVehicle,
} from '@/app/actions/tracker'
import { DashboardLoading } from '@/components/dashboard-loading'
import { StandardTable, type ColumnDefinition } from '@/components/standard-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  dateLabel,
  isValidAmount,
  khr,
  limitDecimalInput,
  maintenanceTotals,
  normalizeDecimalInput,
  usd,
} from '@/lib/utils'

type Item = {
  id: string
  maintenanceRecordId: string
  remark: string
  priceUsd: string
  priceKhr: string
}
type Record = { id: string; serviceDate: string; odometerKm: number | null; items: Item[] }
type RemarkOption = { id: string; name: string }
type Vehicle = {
  id: string
  name: string
  plateNumber: string | null
  notes: string | null
}
type Confirmation =
  { type: 'record'; recordId: string } | { type: 'vehicle'; vehicleId: string; vehicleName: string }

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
    'Remark already exists': t`A remark with this name already exists.`,
    'Remark not found or access denied': t`Remark not found or access denied`,
  }
  const [vehicles] = useState(initialVehicles)
  const [selectedId, setSelectedId] = useState(initialVehicles[0]?.id ?? '')
  const [selectionReady, setSelectionReady] = useState(false)
  const [history, setHistory] = useState<{ vehicleId: string; records: Record[] } | null>(null)
  const [historyLoadErrorFor, setHistoryLoadErrorFor] = useState<string | null>(null)
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
  const [activeSection, setActiveSection] = useState<
    'overview' | 'garage' | 'timeline' | 'remarks'
  >('overview')
  const [pending, startTransition] = useTransition()
  const displayName = userName === 'Driver' ? t`Driver` : userName
  const vehicleName = confirmation?.type === 'vehicle' ? confirmation.vehicleName : ''
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0]
  const selectedVehicleId = selected?.id
  const records = useMemo(
    () => (history?.vehicleId === selectedVehicleId ? history.records : []),
    [history, selectedVehicleId],
  )
  const historyLoading = Boolean(
    selectionReady &&
    selectedVehicleId &&
    history?.vehicleId !== selectedVehicleId &&
    historyLoadErrorFor !== selectedVehicleId,
  )
  const historyLoadError = Boolean(selectedVehicleId && historyLoadErrorFor === selectedVehicleId)

  useEffect(() => {
    if (!selectionReady || !selectedVehicleId) return
    let cancelled = false
    getVehicleServiceHistory(selectedVehicleId)
      .then((loadedHistory) => {
        if (cancelled) return
        setHistory({ vehicleId: selectedVehicleId, records: loadedHistory })
        setHistoryLoadErrorFor(null)
      })
      .catch(() => {
        if (cancelled) return
        setHistoryLoadErrorFor(selectedVehicleId)
      })
    return () => {
      cancelled = true
    }
  }, [selectionReady, selectedVehicleId])

  const totalVisits = records.length
  const totals = records.reduce(
    (sum, record) => {
      const next = maintenanceTotals(record.items)
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
      setHistoryLoadErrorFor(null)
    } catch {
      setNotice(
        t`Error: Browser storage is unavailable, so this selection will not be remembered after refresh.`,
      )
      setNoticeIsError(true)
    }
  }

  function navigateToSection(section: 'overview' | 'garage' | 'timeline' | 'remarks') {
    setActiveSection(section)
    const targetId = section === 'overview' ? 'overview' : section
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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
          onClick={(event) => {
            event.preventDefault()
            navigateToSection('overview')
          }}
        >
          <Activity size={17} /> {t`Overview`}
        </a>
        <a
          className={`nav-item ${activeSection === 'garage' ? 'active' : ''}`}
          href="#garage"
          aria-current={activeSection === 'garage' ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault()
            navigateToSection('garage')
          }}
        >
          <CarFront size={17} /> {t`My garage`} <span className="nav-count">{vehicles.length}</span>
        </a>
        <a
          className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`}
          href="#timeline"
          aria-current={activeSection === 'timeline' ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault()
            navigateToSection('timeline')
          }}
        >
          <Clock3 size={17} /> {t`Service history`}
        </a>
        <a
          className={`nav-item ${activeSection === 'remarks' ? 'active' : ''}`}
          href="#remarks"
          aria-current={activeSection === 'remarks' ? 'location' : undefined}
          onClick={(event) => {
            event.preventDefault()
            navigateToSection('remarks')
          }}
        >
          <Tags size={17} /> {t`Remarks`}
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
                : activeSection === 'remarks'
                  ? t`Remarks`
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
        {activeSection === 'remarks' ? (
          <RemarkManagement />
        ) : (
          <>
            <section className="welcome">
              <div>
                <div className="eyebrow">
                  <Sparkles size={13} /> {t`YOUR GARAGE, IN GOOD ORDER`}
                </div>
                <h1>{greeting ? t`Good ${greeting}, ${name}.` : t`Welcome, ${name}.`}</h1>
                <p>{t`Stay ahead of every mile. Your vehicle care, all in one place.`}</p>
              </div>
            </section>

            {(notice || historyLoadError) && (
              <div
                className={`notice ${noticeIsError || historyLoadError ? 'error' : ''}`}
                role="status"
              >
                {historyLoadError ? t`Could not load service history. Please try again.` : notice}
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
                      <span className="subcount">
                        {vehicles.length.toString().padStart(2, '0')}
                      </span>
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
                            {vehicle.plateNumber || t`No plate number`}
                            {vehicle.id === selected?.id && (
                              <>
                                {' '}
                                <i />{' '}
                                {historyLoading
                                  ? '…'
                                  : `${records.length} ${vehicleVisits(records.length)}`}
                              </>
                            )}
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
                    <button
                      className="button primary log-service-button"
                      onClick={() => setDialog('service')}
                      disabled={!selected}
                    >
                      <CirclePlus size={15} /> {t`Log a service`}
                    </button>
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
                ) : historyLoading ? (
                  <div className="empty-history" aria-live="polite">
                    <div className="empty-icon">
                      <Wrench size={22} />
                    </div>
                    <strong>{t`Loading service history...`}</strong>
                  </div>
                ) : filtered.length ? (
                  <div className="timeline">
                    {filtered.map((record, index) => {
                      const sum = maintenanceTotals(record.items)
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
                                  {record.odometerKm ? (
                                    <span
                                      className={`record-odometer${index === 0 ? '' : ' record-odometer-previous'}`}
                                    >
                                      <Gauge size={13} aria-hidden="true" />
                                      {record.odometerKm.toLocaleString()} km
                                    </span>
                                  ) : (
                                    t`Service visit`
                                  )}
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
                                  <Edit size={15} />
                                </button>
                                <button
                                  className="delete-record-button"
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
                                  <span className="item-name">{item.remark}</span>
                                  <span
                                    className="item-price"
                                    aria-hidden={Number(item.priceUsd) === 0}
                                  >
                                    {Number(item.priceUsd) !== 0 &&
                                      usd(Number(item.priceUsd), locale)}
                                  </span>
                                  <span
                                    className="item-price khr-price"
                                    aria-hidden={Number(item.priceKhr) === 0}
                                  >
                                    {Number(item.priceKhr) !== 0 &&
                                      khr(Number(item.priceKhr), locale)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <footer className="record-total">
                              <span>{t`VISIT TOTAL`}</span>
                              <strong aria-hidden={sum.usd === 0}>
                                {sum.usd !== 0 && usd(sum.usd, locale)}
                              </strong>
                              <strong aria-hidden={sum.khr === 0}>
                                {sum.khr !== 0 && khr(sum.khr, locale)}
                              </strong>
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
                    <strong>
                      {query ? t`No matching service items` : t`No service visits yet`}
                    </strong>
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
                        <strong>
                          {historyLoading ? '—' : String(records.length).padStart(2, '0')}
                        </strong>
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
          </>
        )}
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

function RemarkManagement() {
  const { t } = useLingui()
  const remarkColumns = useMemo<ColumnDefinition<RemarkOption>[]>(
    () => [
      {
        key: 'name',
        label: t`Remark name`,
        type: 'string',
      },
    ],
    [t],
  )
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [remarks, setRemarks] = useState<RemarkOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setLoadError('')
      searchMaintenanceRemarks(query)
        .then((results) => {
          if (!cancelled) setRemarks(results)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setLoadError(
            error instanceof Error ? error.message : t`Could not load remarks. Please try again.`,
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, t])

  async function addRemark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || saving) return

    setSaving(true)
    setSaveError('')
    setNotice('')
    try {
      const createdName = await createMaintenanceRemark(trimmedName)
      setName('')
      setQuery(createdName)
      setNotice(t`Remark added.`)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message === 'Remark already exists'
            ? t`A remark with this name already exists.`
            : error.message
          : t`Could not save remark. Please try again.`,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="remark-catalog" id="remarks">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t`REUSABLE SERVICE NAMES`}</div>
          <h2>{t`Remarks`}</h2>
        </div>
      </div>
      <p className="remark-description">
        {t`Create unique remarks here to use them when logging service work.`}
      </p>
      <form className="remark-create-form" onSubmit={addRemark}>
        <label className="form-label">
          {t`Remark name`}
          <input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t`e.g. Change engine oil`}
          />
        </label>
        <button className="button primary" type="submit" disabled={!name.trim() || saving}>
          <CirclePlus size={15} /> {saving ? t`Adding...` : t`Add remark`}
        </button>
      </form>
      {saveError && (
        <p className="remark-feedback error" role="alert">
          {saveError}
        </p>
      )}
      {notice && (
        <p className="remark-feedback success" role="status">
          {notice}
        </p>
      )}
      <label className="search-field remark-search">
        <Search size={15} />
        <input
          aria-label={t`Search remarks`}
          placeholder={t`Filter remarks by name`}
          maxLength={160}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="remark-result-limit">{t`Showing up to 20 matching remarks.`}</p>
      {loadError ? (
        <p className="remark-feedback error" role="alert">
          {loadError}
        </p>
      ) : loading ? (
        <p className="remark-list-state" aria-live="polite">
          {t`Loading remarks...`}
        </p>
      ) : (
        <StandardTable
          data={remarks}
          columns={remarkColumns}
          className="remark-table"
          enableColumnVisibility={false}
          itemsPerPageOptions={[5, 10, 20]}
          defaultItemsPerPage={10}
          paginationStorageKey="maintenance-remarks"
          showFooter={false}
          emptyStateMessage={query ? t`No matching remarks.` : t`No remarks yet. Add one above.`}
        />
      )}
    </section>
  )
}

function RemarkPicker({
  value,
  onSelect,
  label,
  placeholder,
  inputClassName,
}: {
  value: string
  onSelect: (name: string) => void
  label: string
  placeholder?: string
  inputClassName?: string
}) {
  const { t } = useLingui()
  const listId = useId()
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<RemarkOption[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setOptions([])
      setError('')
      searchMaintenanceRemarks(query)
        .then((results) => {
          if (!cancelled) setOptions(results)
        })
        .catch((searchError: unknown) => {
          if (cancelled) return
          setOptions([])
          setError(
            searchError instanceof Error
              ? searchError.message
              : t`Could not load remarks. Please try again.`,
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, t])

  useEffect(() => {
    if (query && options.some((option) => option.name === query)) onSelect(query)
  }, [onSelect, options, query])

  function updateQuery(nextValue: string) {
    setQuery(nextValue)
    onSelect(options.some((option) => option.name === nextValue) ? nextValue : '')
  }

  return (
    <div className="remark-picker">
      <input
        className={inputClassName}
        type="text"
        list={listId}
        autoComplete="off"
        maxLength={160}
        aria-label={label}
        placeholder={placeholder}
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option value={option.name} key={option.id} />
        ))}
      </datalist>
      {loading && <span className="remark-picker-message">{t`Searching remarks...`}</span>}
      {!loading && !error && options.length === 0 && (
        <span className="remark-picker-message">
          {t`No matching remarks. Create one from Remarks in the sidebar.`}
        </span>
      )}
      {error && (
        <span className="remark-picker-message error" role="alert">
          {error}
        </span>
      )}
    </div>
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
    items: { remark: string; priceUsd: number; priceKhr: number }[]
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
      priceUsd: item.priceUsd,
      priceKhr: item.priceKhr,
    })) ?? [],
  )
  const [editingItem, setEditingItem] = useState<{
    index: number
    remark: string
    priceUsd: string
    priceKhr: string
  } | null>(null)
  const [itemConfirmation, setItemConfirmation] = useState<{ index: number } | null>(null)
  const [draftRemark, setDraftRemark] = useState('')
  const [draftPriceUsd, setDraftPriceUsd] = useState('0')
  const [draftPriceKhr, setDraftPriceKhr] = useState('0')
  const [isAddingItem, setIsAddingItem] = useState(initial === null)
  const draftInputSelection = useRef(new WeakMap<HTMLInputElement, boolean>())
  const selectEditedRemark = useCallback((remark: string) => {
    setEditingItem((current) => (current ? { ...current, remark } : current))
  }, [])
  const subtotalUsd = items.reduce((sum, item) => sum + Number(item.priceUsd || 0), 0)
  const subtotalKhr = items.reduce((sum, item) => sum + Number(item.priceKhr || 0), 0)
  function toggleDraftInputSelection(input: HTMLInputElement) {
    const isSelected = draftInputSelection.current.get(input) ?? false
    if (isSelected) {
      input.setSelectionRange(input.value.length, input.value.length)
    } else {
      input.select()
    }
    draftInputSelection.current.set(input, !isSelected)
  }
  function addItem() {
    const priceUsd = Number(draftPriceUsd || 0)
    const priceKhr = Number(draftPriceKhr || 0)
    if (
      !draftRemark.trim() ||
      !isValidAmount(draftPriceUsd, 1e24) ||
      !isValidAmount(draftPriceKhr, 1e24)
    ) {
      return
    }
    setItems((current) => [
      ...current,
      {
        remark: draftRemark.trim(),
        priceUsd: String(priceUsd),
        priceKhr: String(priceKhr),
      },
    ])
    setDraftRemark('')
    setDraftPriceUsd('0')
    setDraftPriceKhr('0')
    setIsAddingItem(false)
  }
  function hasEditingItemChanges() {
    if (!editingItem) return false
    const original = items[editingItem.index]
    if (!original) return false
    return (
      editingItem.remark.trim() !== original.remark ||
      Number(editingItem.priceUsd || 0) !== Number(original.priceUsd || 0) ||
      Number(editingItem.priceKhr || 0) !== Number(original.priceKhr || 0)
    )
  }
  function saveEditedItem() {
    if (
      !editingItem ||
      !hasEditingItemChanges() ||
      !editingItem.remark.trim() ||
      !isValidAmount(editingItem.priceUsd, 1e24) ||
      !isValidAmount(editingItem.priceKhr, 1e24)
    ) {
      return
    }
    setItems((current) =>
      current.map((item, index) =>
        index === editingItem.index
          ? {
              remark: editingItem.remark.trim(),
              priceUsd: String(Number(editingItem.priceUsd || 0)),
              priceKhr: String(Number(editingItem.priceKhr || 0)),
            }
          : item,
      ),
    )
    setEditingItem(null)
  }
  function confirmItemRemoval() {
    if (!itemConfirmation) return
    setItems((current) => current.filter((_, index) => index !== itemConfirmation.index))
    setItemConfirmation(null)
  }
  return (
    <>
      <Modal
        title={initial ? t`Edit service visit` : t`Log a service`}
        subtitle={t`Record the visit and the work completed.`}
        onClose={onClose}
        wide
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (editingItem !== null) return
            onSave({
              vehicleId: vehicle.id,
              serviceDate,
              odometerKm: odometerKm ? Number(odometerKm) : undefined,
              items: items.map((item) => ({
                remark: item.remark,
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
            <button
              type="button"
              className="button quiet item-add-button"
              aria-expanded={isAddingItem}
              aria-controls="item-entry-form"
              disabled={!isAddingItem && (items.length >= 30 || editingItem !== null)}
              onClick={() => setIsAddingItem((current) => !current)}
            >
              {isAddingItem ? (
                t`Cancel`
              ) : (
                <>
                  <CirclePlus size={14} /> {t`Add item`}
                </>
              )}
            </button>
          </div>
          {isAddingItem && (
            <div className="item-entry-form" id="item-entry-form">
              <label className="form-label item-entry-remark">
                {t`Remark`}
                <RemarkPicker
                  label={t`Remark`}
                  placeholder={t`Search or select a remark`}
                  value={draftRemark}
                  onSelect={setDraftRemark}
                />
              </label>
              <label className="form-label">
                {t`Price`} USD ($)
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={31}
                  value={draftPriceUsd}
                  onBlur={(event) => draftInputSelection.current.delete(event.currentTarget)}
                  onClick={(event) => toggleDraftInputSelection(event.currentTarget)}
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
                  maxLength={31}
                  value={draftPriceKhr}
                  onBlur={(event) => draftInputSelection.current.delete(event.currentTarget)}
                  onClick={(event) => toggleDraftInputSelection(event.currentTarget)}
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
                  !isValidAmount(draftPriceUsd, 1e24) ||
                  !isValidAmount(draftPriceKhr, 1e24) ||
                  items.length >= 30 ||
                  editingItem !== null
                }
              >
                <CirclePlus size={14} /> {t`Add item`}
              </button>
            </div>
          )}
          <div className="line-items-table-wrap">
            <table className="line-items-table">
              <thead>
                <tr>
                  <th scope="col">{t`Remark`}</th>
                  <th scope="col">{t`Price`} USD ($)</th>
                  <th scope="col">{t`Price`} KHR (៛)</th>
                  <th scope="col">
                    <span className="sr-only">{t`Actions`}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td className="empty-items" colSpan={4}>{t`No work or parts added yet`}</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index}>
                      {editingItem?.index === index ? (
                        <>
                          <td>
                            <RemarkPicker
                              label={t`Remark`}
                              inputClassName="line-item-input"
                              value={editingItem.remark}
                              onSelect={selectEditedRemark}
                            />
                          </td>
                          <td>
                            <input
                              className="line-item-input"
                              aria-label={t`Price USD`}
                              inputMode="decimal"
                              maxLength={31}
                              value={editingItem.priceUsd}
                              onChange={(event) => {
                                const value = limitDecimalInput(event.target.value)
                                if (value !== null)
                                  setEditingItem({ ...editingItem, priceUsd: value })
                              }}
                            />
                          </td>
                          <td>
                            <input
                              className="line-item-input"
                              aria-label={t`Price KHR`}
                              inputMode="decimal"
                              maxLength={31}
                              value={editingItem.priceKhr}
                              onChange={(event) => {
                                const value = limitDecimalInput(event.target.value)
                                if (value !== null)
                                  setEditingItem({ ...editingItem, priceKhr: value })
                              }}
                            />
                          </td>
                          <td>
                            <div className="line-item-actions">
                              <button
                                type="button"
                                className="line-item-action"
                                aria-label={t`Save line item`}
                                disabled={
                                  !hasEditingItemChanges() ||
                                  !editingItem.remark.trim() ||
                                  !isValidAmount(editingItem.priceUsd, 1e24) ||
                                  !isValidAmount(editingItem.priceKhr, 1e24)
                                }
                                onClick={saveEditedItem}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className="line-item-action"
                                aria-label={t`Cancel line item edit`}
                                onClick={() => setEditingItem(null)}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{item.remark}</td>
                          <td>{usd(Number(item.priceUsd), locale)}</td>
                          <td>{khr(Number(item.priceKhr), locale)}</td>
                          <td>
                            <div className="line-item-actions">
                              <button
                                type="button"
                                className="line-item-action"
                                aria-label={t`Edit line item`}
                                disabled={editingItem !== null}
                                onClick={() =>
                                  setEditingItem({
                                    index,
                                    remark: item.remark,
                                    priceUsd: normalizeDecimalInput(item.priceUsd),
                                    priceKhr: normalizeDecimalInput(item.priceKhr),
                                  })
                                }
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="remove-line"
                                aria-label={t`Remove line item`}
                                disabled={editingItem !== null}
                                onClick={() => setItemConfirmation({ index })}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
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
            <button
              className="button primary"
              disabled={busy || items.length === 0 || editingItem !== null}
            >
              <Check size={15} /> {initial ? t`Save changes` : t`Save service`}
            </button>
          </div>
        </form>
      </Modal>
      {itemConfirmation && (
        <ConfirmDialog
          title={t`Remove line item?`}
          description={t`This removes the line item from this service visit.`}
          confirmLabel={t`Remove item`}
          confirmVariant="danger"
          onCancel={() => setItemConfirmation(null)}
          onConfirm={confirmItemRemoval}
        />
      )}
    </>
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
