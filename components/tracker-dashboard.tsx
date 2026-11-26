'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Activity, ArrowDownRight, ArrowUpRight, Bike, CarFront, Check, ChevronDown, CirclePlus, Clock3, FileText, Gauge, PenLine, Search, Settings2, ShieldCheck, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import { createVehicle, deleteVehicle, removeMaintenance, saveMaintenance, updateVehicle } from '@/app/actions/tracker'

type Item = { id: string; maintenanceRecordId: string; remark: string; priceUsd: string; priceKhr: string }
type Record = { id: string; serviceDate: string; odometerKm: number | null; items: Item[] }
type Vehicle = { id: string; name: string; plateNumber: string | null; notes: string | null; records: Record[] }

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
const khr = (value: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ៛`
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
const totalsFor = (record: Record) => record.items.reduce((totals, item) => ({ usd: totals.usd + Number(item.priceUsd), khr: totals.khr + Number(item.priceKhr) }), { usd: 0, khr: 0 })

export function TrackerDashboard({ vehicles: initialVehicles, userName }: { vehicles: Vehicle[]; userName: string }) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [selectedId, setSelectedId] = useState(initialVehicles[0]?.id ?? '')
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
  }, [])
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<'vehicle' | 'service' | null>(null)
  const [editing, setEditing] = useState<Record | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [notice, setNotice] = useState('')
  const [activeSection, setActiveSection] = useState<'overview' | 'garage' | 'timeline'>('overview')
  const [pending, startTransition] = useTransition()
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0]
  const records = selected?.records ?? []
  const totalVisits = records.length
  const totals = records.reduce((sum, record) => { const next = totalsFor(record); return { usd: sum.usd + next.usd, khr: sum.khr + next.khr } }, { usd: 0, khr: 0 })
  const filtered = useMemo(() => records.filter((record) => record.items.some((item) => item.remark.toLowerCase().includes(query.toLowerCase()))), [records, query])
  const latest = records[0]
  const newestDate = latest ? new Date(latest.serviceDate) : null
  const daysSince = newestDate && currentTime ? Math.max(0, Math.floor((currentTime.getTime() - newestDate.getTime()) / 86400000)) : null
  const greeting = currentTime ? (currentTime.getHours() < 12 ? 'morning' : currentTime.getHours() < 18 ? 'afternoon' : 'evening') : null

  function run(action: () => Promise<void>, success: string) {
    setNotice('')
    startTransition(async () => {
      try { await action(); setNotice(success); window.location.reload() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Something went wrong. Please try again.') }
    })
  }

  return <div className="shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Gauge size={19} /></span><span>motive<span className="brand-dot">.</span><small>VEHICLE CARE</small></span></Link>
      <div className="nav-label">WORKSPACE</div>
      <a className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`} href="#overview" aria-current={activeSection === 'overview' ? 'location' : undefined} onClick={() => setActiveSection('overview')}><Activity size={17} /> Overview</a>
      <a className={`nav-item ${activeSection === 'garage' ? 'active' : ''}`} href="#garage" aria-current={activeSection === 'garage' ? 'location' : undefined} onClick={() => setActiveSection('garage')}><CarFront size={17} /> My garage <span className="nav-count">{vehicles.length}</span></a>
      <a className={`nav-item ${activeSection === 'timeline' ? 'active' : ''}`} href="#timeline" aria-current={activeSection === 'timeline' ? 'location' : undefined} onClick={() => setActiveSection('timeline')}><Clock3 size={17} /> Service history</a>
      <div className="sidebar-spacer" />
      <div className="secure-note"><ShieldCheck size={16} /><span>Your records are private<br />and secured to your account.</span></div>
      <button className="account" onClick={() => signOut({ callbackUrl: '/login' })}><span className="avatar">{userName.trim().charAt(0).toUpperCase()}</span><span className="account-name">{userName}<small>Personal workspace</small></span><ChevronDown size={15} /></button>
    </aside>

    <main className="main" id="overview">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> {activeSection === 'garage' ? 'My garage' : activeSection === 'timeline' ? 'Service history' : 'Overview'}</div><div className="top-actions"><span className="live-dot"><i /> All systems ready</span><button className="icon-button" aria-label="Settings"><Settings2 size={18} /></button></div></header>
      <section className="welcome"><div><div className="eyebrow"><Sparkles size={13} /> YOUR GARAGE, IN GOOD ORDER</div><h1>{greeting ? `Good ${greeting}` : 'Welcome'}, {userName.split(' ')[0]}.</h1><p>Stay ahead of every mile. Your vehicle care, all in one place.</p></div><button className="button primary" onClick={() => setDialog('service')} disabled={!selected}><CirclePlus size={17} /> Log a service</button></section>

      {notice && <div className={`notice ${notice.includes('Error') || notice.includes('failed') ? 'error' : ''}`} role="status">{notice}</div>}
      <section className="stat-grid" aria-label="Maintenance summary">
        <Stat icon={<Wrench size={17} />} label="SERVICE VISITS" value={String(totalVisits).padStart(2, '0')} note={totalVisits ? `${totalVisits} recorded ${totalVisits === 1 ? 'visit' : 'visits'}` : 'Start your service history'} accent="amber" />
        <Stat icon={<ArrowUpRight size={17} />} label="TOTAL SPENT · USD" value={usd(totals.usd)} note="Across all service visits" accent="green" />
        <Stat icon={<Activity size={17} />} label="TOTAL SPENT · KHR" value={khr(totals.khr)} note="Cambodian riel" accent="blue" />
        <Stat icon={<Clock3 size={17} />} label="LAST SERVICE" value={latest && daysSince !== null ? `${daysSince}d ago` : '—'} note={latest ? dateLabel(latest.serviceDate) : 'No visits yet'} accent="violet" />
      </section>

      <section className="content-grid">
        <div className="primary-column">
          <div className="section-heading" id="garage"><div><div className="eyebrow">YOUR VEHICLES</div><h2>Garage <span className="subcount">{vehicles.length.toString().padStart(2, '0')}</span></h2></div><button className="button quiet" onClick={() => { setEditingVehicle(null); setDialog('vehicle') }}><CirclePlus size={16} /> Add vehicle</button></div>
          {vehicles.length ? <div className="vehicle-list">{vehicles.map((vehicle) => <button key={vehicle.id} className={`vehicle-card ${vehicle.id === selected?.id ? 'selected' : ''}`} onClick={() => setSelectedId(vehicle.id)} aria-pressed={vehicle.id === selected?.id}><span className="vehicle-icon">{vehicle.name.toLowerCase().includes('motor') || vehicle.name.toLowerCase().includes('bike') ? <Bike size={20} /> : <CarFront size={21} />}</span><span className="vehicle-info"><strong>{vehicle.name}</strong><small>{vehicle.plateNumber || 'No plate number'} <i /> {vehicle.records.length} {vehicle.records.length === 1 ? 'visit' : 'visits'}</small></span><span className="vehicle-select">{vehicle.id === selected?.id ? <Check size={15} /> : <ArrowDownRight size={15} />}</span></button>)}</div> : <div className="empty-garage"><div className="empty-icon"><CarFront size={23} /></div><strong>Your garage is ready</strong><span>Add your first vehicle to start tracking its care.</span><button className="button primary" onClick={() => { setEditingVehicle(null); setDialog('vehicle') }}><CirclePlus size={16} /> Add your first vehicle</button></div>}

          <div className="section-heading history-heading" id="timeline"><div><div className="eyebrow">THE COMPLETE PICTURE</div><h2>Service history</h2></div><div className="history-actions"><label className="search-field"><Search size={15} /><input aria-label="Filter service items" placeholder="Find a part or service" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{selected && <Link className="export-button" href={`/vehicles/${selected.id}/print`} target="_blank"><FileText size={15} /> Report</Link>}</div></div>

          {!selected ? <div className="empty-history"><div className="empty-icon"><Wrench size={22} /></div><strong>Your maintenance timeline starts here</strong><span>Add a vehicle, then log each service visit and its parts.</span></div> : filtered.length ? <div className="timeline">{filtered.map((record, index) => { const sum = totalsFor(record); return <article className="timeline-row" key={record.id}><div className="timeline-rail"><span className="timeline-node">{index === 0 ? <span className="node-core" /> : null}</span></div><div className="record-card"><header className="record-head"><div><span className="record-date">{dateLabel(record.serviceDate)}</span><span className="record-meta">{record.odometerKm ? `${record.odometerKm.toLocaleString()} km` : 'Service visit'}{index === 0 ? <b className="latest-tag">LATEST</b> : null}</span></div><div className="record-controls"><button aria-label="Edit service record" onClick={() => { setEditing(record); setDialog('service') }}><Settings2 size={15} /></button><button aria-label="Delete service record" onClick={() => { if (window.confirm('Delete this service visit and its line items?')) run(() => removeMaintenance(record.id), 'Service visit deleted.') }}><Trash2 size={15} /></button></div></header><div className="item-list">{record.items.map((item) => <div className="service-item" key={item.id}><span className="item-check"><Check size={12} /></span><span className="item-name">{item.remark}</span><span className="item-price">{usd(Number(item.priceUsd))}</span><span className="item-price khr-price">{khr(Number(item.priceKhr))}</span></div>)}</div><footer className="record-total"><span>VISIT TOTAL</span><strong>{usd(sum.usd)}</strong><strong>{khr(sum.khr)}</strong></footer></div></article> })}<div className="timeline-end">↑ &nbsp; CHRONOLOGICAL PROGRESSION</div></div> : <div className="empty-history"><div className="empty-icon"><Search size={21} /></div><strong>{query ? 'No matching service items' : 'No service visits yet'}</strong><span>{query ? 'Try another part name or clear your search.' : 'Your maintenance entries will appear here.'}</span>{!query && <button className="text-button" onClick={() => setDialog('service')}>Add the first service record <ArrowUpRight size={14} /></button>}</div>}
        </div>
        <aside className="insight-column"><div className="insight-card focus-card"><div className="insight-top"><span className="insight-icon"><Gauge size={17} /></span><span className="insight-kicker">CURRENT VEHICLE</span></div>{selected ? <><h3>{selected.name}</h3><div className="plate-chip">{selected.plateNumber || 'PLATE NOT ADDED'}</div><div className="insight-divider"/><div className="insight-data"><span>Visits tracked</span><strong>{String(selected.records.length).padStart(2, '0')}</strong></div><div className="insight-data"><span>Last service</span><strong>{latest ? dateLabel(latest.serviceDate) : '—'}</strong></div><div className="insight-data"><span>Lifetime spend</span><strong>{usd(totals.usd)}</strong></div><button className="text-button" onClick={() => { setEditingVehicle(selected); setDialog('vehicle') }}><PenLine size={14} /> Edit vehicle details</button><button className="remove-vehicle" onClick={() => { if (window.confirm(`Remove ${selected.name} and all its service history?`)) run(() => deleteVehicle(selected.id), 'Vehicle removed.') }}><Trash2 size={14} /> Remove vehicle</button></> : <p className="muted">Choose a vehicle to see its details.</p>}</div><div className="tip-card"><div className="tip-icon"><Sparkles size={16} /></div><span className="insight-kicker">A LITTLE HEAD START</span><h3>Small checks.<br />Longer journeys.</h3><p>Keep service dates and mileage up to date to spot patterns in your vehicle care.</p></div><div className="privacy-line"><ShieldCheck size={15} /><span>Private by design. Your records belong to your account.</span></div></aside>
      </section>
    </main>

    {dialog === 'vehicle' && <VehicleDialog initial={editingVehicle} busy={pending} onClose={() => { setDialog(null); setEditingVehicle(null) }} onSave={(values) => run(async () => { if (editingVehicle) await updateVehicle(editingVehicle.id, values); else await createVehicle(values) }, editingVehicle ? 'Vehicle details updated.' : 'Vehicle added.')} />}
    {dialog === 'service' && selected && <ServiceDialog vehicle={selected} initial={editing} busy={pending} onClose={() => { setDialog(null); setEditing(null) }} onSave={(values) => run(async () => { await saveMaintenance(values, editing?.id) }, editing ? 'Service visit updated.' : 'Service visit saved.')} />}
  </div>
}

function Stat({ icon, label, value, note, accent }: { icon: React.ReactNode; label: string; value: string; note: string; accent: string }) { return <article className="stat-card"><span className={`stat-icon ${accent}`}>{icon}</span><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></article> }

function VehicleDialog({ initial, busy, onClose, onSave }: { initial: Vehicle | null; busy: boolean; onClose: () => void; onSave: (value: { name: string; plateNumber?: string; notes?: string }) => void }) {
  const [name, setName] = useState(initial?.name ?? ''); const [plateNumber, setPlate] = useState(initial?.plateNumber ?? ''); const [notes, setNotes] = useState(initial?.notes ?? '')
  const isEditing = Boolean(initial)
  return <Modal title={isEditing ? 'Edit vehicle details' : 'Add a vehicle'} subtitle={isEditing ? 'Update this vehicle’s name, plate number, or notes.' : 'Give your vehicle a name you’ll recognize.'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ name, plateNumber, notes }) }}><label className="form-label">Vehicle name<input autoFocus required minLength={2} maxLength={80} placeholder="e.g. Honda Dream 2017" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-label">Plate number <span>OPTIONAL</span><input maxLength={24} placeholder="e.g. 2AB-1234" value={plateNumber} onChange={(event) => setPlate(event.target.value)} /></label><label className="form-label">Notes <span>OPTIONAL</span><textarea maxLength={500} rows={3} placeholder="Anything useful to remember" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="modal-actions"><button type="button" className="button quiet" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}><CirclePlus size={15} /> {isEditing ? 'Save changes' : 'Save vehicle'}</button></div></form></Modal>
}

function ServiceDialog({ vehicle, initial, busy, onClose, onSave }: { vehicle: Vehicle; initial: Record | null; busy: boolean; onClose: () => void; onSave: (value: { vehicleId: string; serviceDate: string; odometerKm?: number; items: { remark: string; priceUsd: number; priceKhr: number }[] }) => void }) {
  const [serviceDate, setDate] = useState(initial ? initial.serviceDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [odometerKm, setOdometer] = useState(initial?.odometerKm?.toString() ?? '')
  const [items, setItems] = useState(initial?.items.map((item) => ({ remark: item.remark, priceUsd: item.priceUsd, priceKhr: item.priceKhr })) ?? [{ remark: '', priceUsd: '0', priceKhr: '0' }])
  const subtotalUsd = items.reduce((sum, item) => sum + Number(item.priceUsd || 0), 0); const subtotalKhr = items.reduce((sum, item) => sum + Number(item.priceKhr || 0), 0)
  function update(index: number, key: 'remark' | 'priceUsd' | 'priceKhr', value: string) { setItems((current) => current.map((item, row) => row === index ? { ...item, [key]: value } : item)) }
  return <Modal title={initial ? 'Edit service visit' : 'Log a service'} subtitle="Record the visit and the work completed." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ vehicleId: vehicle.id, serviceDate, odometerKm: odometerKm ? Number(odometerKm) : undefined, items: items.map((item) => ({ remark: item.remark, priceUsd: Number(item.priceUsd || 0), priceKhr: Number(item.priceKhr || 0) })) }) }}><div className="form-row"><label className="form-label">Service date<input type="date" required value={serviceDate} onChange={(event) => setDate(event.target.value)} /></label><label className="form-label">Odometer <span>KM</span><input type="number" min="0" placeholder="Optional" value={odometerKm} onChange={(event) => setOdometer(event.target.value)} /></label></div><div className="line-items-title"><strong>Work & parts</strong><button type="button" className="text-button" onClick={() => setItems((current) => [...current, { remark: '', priceUsd: '0', priceKhr: '0' }])}><CirclePlus size={14} /> Add item</button></div>{items.map((item, index) => <div className="line-item-form" key={index}><div className="line-item-top"><label className="form-label">Remark<input required maxLength={160} placeholder="e.g. Change engine oil" value={item.remark} onChange={(event) => update(index, 'remark', event.target.value)} /></label><button type="button" className="remove-line" aria-label="Remove line item" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, row) => row !== index))}><X size={15} /></button></div><div className="form-row"><label className="form-label">USD ($)<input type="number" min="0" step="0.01" value={item.priceUsd} onChange={(event) => update(index, 'priceUsd', event.target.value)} /></label><label className="form-label">KHR (៛)<input type="number" min="0" step="1" value={item.priceKhr} onChange={(event) => update(index, 'priceKhr', event.target.value)} /></label></div></div>)}<div className="subtotal"><span>VISIT SUBTOTAL</span><strong>{usd(subtotalUsd)} <i /> {khr(subtotalKhr)}</strong></div><div className="modal-actions"><button type="button" className="button quiet" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}><Check size={15} /> {initial ? 'Save changes' : 'Save service'}</button></div></form></Modal>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></header>{children}</section></div> }
