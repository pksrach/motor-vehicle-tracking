import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type Locale = 'en' | 'km'

const khmerMonths = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
]

function formatLocale(locale: Locale) {
  return locale === 'km' ? 'km-KH' : 'en-US'
}

export function limitDecimalInput(value: string) {
  if (!/^\d*\.?\d*$/.test(value)) return null
  const [whole, fraction] = value.split('.')
  return fraction === undefined ? whole : `${whole}.${fraction.slice(0, 6)}`
}

export function normalizeDecimalInput(value: string | number) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

export function isValidAmount(value: string, max: number) {
  const amount = Number(value)
  return (
    Number.isFinite(amount) && amount >= 0 && amount < max && Number(amount.toFixed(6)) === amount
  )
}

export function usd(value: number, locale: Locale) {
  return new Intl.NumberFormat(formatLocale(locale), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

export function khr(value: number, locale: Locale) {
  return `${new Intl.NumberFormat(formatLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value)} ៛`
}

export function dateLabel(value: string, locale: Locale) {
  const date = new Date(value)
  if (locale === 'km') {
    const day = String(date.getDate()).padStart(2, '0')
    const month = khmerMonths[date.getMonth()]
    const year = String(date.getFullYear())
    return `${day} ${month} ${year}`
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

type MaintenanceCostItem = {
  priceUsd: string
  priceKhr: string
}

export function maintenanceTotals(items: readonly MaintenanceCostItem[]) {
  return items.reduce(
    (totals, item) => ({
      usd: totals.usd + Number(item.priceUsd),
      khr: totals.khr + Number(item.priceKhr),
    }),
    { usd: 0, khr: 0 },
  )
}

export function formatReportDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
