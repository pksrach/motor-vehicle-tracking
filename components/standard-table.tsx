'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { isValidElement } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { ChevronLeft, ChevronRight, Minus, Plus, Settings, Pencil, Trash2 } from 'lucide-react'
import { Trans } from '@lingui/react'

/**
 * Column Type Definitions
 */
export type ColumnType = 'string' | 'number' | 'currency' | 'date' | 'boolean' | 'status' | 'custom'

export type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface ColumnDefinition<T extends object> {
  /** Unique column identifier */
  key: keyof T
  /** Display label (i18n key or text) */
  label: string | React.ReactNode
  /** Column type for automatic formatting */
  type: ColumnType
  /** Width class (e.g., 'w-24', 'w-32') - optional */
  width?: string
  /** Text alignment (default: 'left') */
  align?: 'left' | 'center' | 'right'
  /** Custom formatter function */
  formatter?: (value: T[keyof T], row: T, locale?: string) => React.ReactNode
  /** For currency type: specify 'USD', 'KHR', etc. */
  currencyCode?: string
  /** For status type: map values to variants */
  statusMap?: Record<string, { label: string | React.ReactNode; variant: StatusVariant }>
  /** Hide this column by default */
  hidden?: boolean
  /** Enable column visibility toggle */
  toggleable?: boolean
  /** For footer: show sum/count/avg */
  footerType?: 'sum' | 'count' | 'avg' | 'custom'
  /** Custom footer value calculator */
  footerFormatter?: (rows: T[]) => React.ReactNode
  /** Make column not visible in visibility menu */
  alwaysVisible?: boolean
  /** Pin column using CSS sticky */
  pinned?: 'left' | 'right'
}

export interface StandardTableProps<T extends object> {
  /** Table data */
  data: T[]
  /** Column definitions */
  columns: ColumnDefinition<T>[]
  /** Table title */
  title?: string | React.ReactNode
  /** Table description */
  description?: string | React.ReactNode
  /** Enable pagination */
  enablePagination?: boolean
  /** Items per page options */
  itemsPerPageOptions?: number[]
  /** Default items per page */
  defaultItemsPerPage?: number
  /** Storage key for pagination state */
  paginationStorageKey?: string
  /** Enable column visibility toggle */
  enableColumnVisibility?: boolean
  /** Storage key for column visibility */
  columnVisibilityStorageKey?: string
  /** Enable column pinning controls */
  enableColumnPinning?: boolean
  /** Storage key for column pinning state */
  columnPinningStorageKey?: string
  /** Enable zoom controls for the table area */
  enableZoomControl?: boolean
  /** Storage key for table zoom state */
  zoomStorageKey?: string
  /** Show empty state message */
  emptyStateMessage?: string | React.ReactNode
  /** Row click handler */
  onRowClick?: (row: T) => void
  /** Edit button handler */
  onEdit?: (row: T) => void
  /** Delete button handler */
  onDelete?: (row: T) => void
  /** Show edit/delete actions */
  showActions?: boolean
  /** Custom row actions */
  customActions?: Array<{
    label: string | React.ReactNode
    icon?: React.ReactNode
    onClick: (row: T) => void
  }>
  /** Show footer */
  showFooter?: boolean
  /** i18n locale */
  locale?: string
  /** Class name for card */
  className?: string
  /** Max height for table container */
  maxHeight?: string
  /** Enable row selection with checkboxes */
  enableRowSelection?: boolean
  /** Selected rows state */
  selectedRows?: T[]
  /** Callback when selected rows change */
  onSelectedRowsChange?: (selectedRows: T[]) => void
}

/**
 * Format value based on column type
 */
function formatCellValue<T extends object>(
  value: unknown,
  columnType: ColumnType,
  columnDef: Pick<ColumnDefinition<T>, 'currencyCode'>,
  locale: string = 'en-US',
): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  switch (columnType) {
    case 'string':
      return String(value)

    case 'number':
      return Number(value).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

    case 'currency': {
      const numValue = Number(value)
      const currencyCode = columnDef.currencyCode || 'USD'

      if (currencyCode === 'KHR') {
        return `${numValue.toLocaleString(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })} ៛`
      }

      return `${numValue.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${currencyCode === 'USD' ? '$' : currencyCode}`
    }

    case 'date': {
      // Format as dd/MM/yyyy
      if (!value) return '-'

      let dateStr: string

      // Handle both Date objects and string values
      if (value instanceof Date) {
        const year = value.getFullYear()
        const month = String(value.getMonth() + 1).padStart(2, '0')
        const day = String(value.getDate()).padStart(2, '0')
        dateStr = `${year}-${month}-${day}`
      } else {
        dateStr = String(value)
      }

      const parts = dateStr.split('-')
      if (parts.length !== 3) return String(value)
      const [year, month, day] = parts
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    }

    case 'boolean':
      return value ? '✓' : '✗'

    case 'status':
    case 'custom':
      return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        isValidElement(value)
        ? value
        : String(value)

    default:
      return String(value)
  }
}

/**
 * Calculate footer value
 */
function calculateFooterValue<T extends object>(
  rows: T[],
  key: keyof T,
  footerType?: ColumnDefinition<T>['footerType'],
): number | null {
  if (!footerType || footerType === 'custom') return null

  const values = rows
    .map((row) => {
      const val = row[key]
      return typeof val === 'number' ? val : Number(val) || 0
    })
    .filter((v) => !isNaN(v))

  if (values.length === 0) return null

  switch (footerType) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'count':
      return values.length
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    default:
      return null
  }
}

/**
 * Standard Table Component
 */
export function StandardTable<T extends object>({
  data,
  columns,
  title,
  description,
  enablePagination = true,
  itemsPerPageOptions = [10, 25, 50, 100],
  defaultItemsPerPage = 10,
  paginationStorageKey = 'standard_table_pagination',
  enableColumnVisibility = true,
  columnVisibilityStorageKey = 'standard_table_column_visibility',
  enableColumnPinning = false,
  columnPinningStorageKey = 'standard_table_column_pinning',
  enableZoomControl = false,
  zoomStorageKey,
  emptyStateMessage,
  onRowClick,
  onEdit,
  onDelete,
  showActions = false,
  customActions = [],
  showFooter = true,
  locale = 'en-US',
  className = '',
  maxHeight = 'max-h-96',
  enableRowSelection = false,
  selectedRows = [],
  onSelectedRowsChange,
}: StandardTableProps<T>) {
  const MIN_ZOOM = 0.8
  const MAX_ZOOM = 1.5
  const ZOOM_STEP = 0.1

  // Initialize column visibility state
  const defaultVisibility: Record<string, boolean> = {}
  columns.forEach((col) => {
    const key = String(col.key)
    defaultVisibility[key] = !col.hidden
  })

  const [columnVisibility, setColumnVisibility] = useLocalStorage<Record<string, boolean>>(
    columnVisibilityStorageKey,
    defaultVisibility,
  )

  const defaultPinning: Record<string, 'left' | 'right' | 'none'> = {}
  columns.forEach((col) => {
    const key = String(col.key)
    defaultPinning[key] = col.pinned ?? 'none'
  })

  const [columnPinning, setColumnPinning] = useLocalStorage<
    Record<string, 'left' | 'right' | 'none'>
  >(columnPinningStorageKey, defaultPinning)

  const [tableZoom, setTableZoom] = useLocalStorage<number>(
    zoomStorageKey ?? `${paginationStorageKey}_zoom`,
    1,
  )

  const normalizedZoom = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Number.isFinite(tableZoom) ? tableZoom : 1),
  )

  useEffect(() => {
    if (normalizedZoom !== tableZoom) {
      setTableZoom(normalizedZoom)
    }
  }, [normalizedZoom, tableZoom, setTableZoom])

  const changeZoom = (delta: number) => {
    setTableZoom((current) => {
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, (Number.isFinite(current) ? current : 1) + delta),
      )
      return Number(nextZoom.toFixed(1))
    })
  }

  const resetZoom = () => setTableZoom(1)

  // Detect whether the browser supports the non-standard `zoom` CSS property.
  // Many mobile browsers don't support `zoom`, so fall back to `transform: scale(...)`
  // and compensate the inner width so scaling behaves like zoom visually.
  const supportsZoom = useMemo(() => {
    try {
      return typeof window !== 'undefined' && !!window.CSS && CSS.supports
        ? CSS.supports('zoom', '1')
        : false
    } catch {
      return false
    }
  }, [])

  const zoomStyle = useMemo(() => {
    const z = normalizedZoom
    if (supportsZoom) {
      return { zoom: z } as React.CSSProperties
    }

    const s = `scale(${z})`
    return {
      transform: s,
      WebkitTransform: s,
      transformOrigin: '0 0',
      display: 'block',
      width: `${100 / z}%`,
    } as React.CSSProperties
  }, [normalizedZoom, supportsZoom])

  // Pagination state
  const [currentPage, setCurrentPage] = useLocalStorage<number>(`${paginationStorageKey}_page`, 1)
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>(
    `${paginationStorageKey}_items`,
    defaultItemsPerPage,
  )

  // Delete confirmation state
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [rowToDelete, setRowToDelete] = useState<T | null>(null)

  // Row selection handlers
  const isRowSelected = (row: T): boolean => {
    return selectedRows.some((selected) => selected === row)
  }

  const toggleRowSelection = (row: T) => {
    if (!onSelectedRowsChange) return
    if (isRowSelected(row)) {
      onSelectedRowsChange(selectedRows.filter((r) => r !== row))
    } else {
      onSelectedRowsChange([...selectedRows, row])
    }
  }

  const selectAllVisibleRows = () => {
    if (!onSelectedRowsChange) return
    // Select all rows on current page when pagination is enabled,
    // otherwise select all rows in data
    const allRows = enablePagination ? paginatedData : data
    const newSelected = [...selectedRows]
    allRows.forEach((row) => {
      if (!isRowSelected(row)) {
        newSelected.push(row)
      }
    })
    onSelectedRowsChange(newSelected)
  }

  const deselectAllVisibleRows = () => {
    if (!onSelectedRowsChange) return
    const visibleRowsSet = new Set(enablePagination ? paginatedData : data)
    const newSelected = selectedRows.filter((row) => !visibleRowsSet.has(row))
    onSelectedRowsChange(newSelected)
  }

  // Pagination calculations
  const totalItems = data.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const paginatedData = enablePagination
    ? data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : data

  // Reset to page 1 if out of range
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1)
  }

  const visibleColumns = useMemo(
    () => columns.filter((col) => columnVisibility[String(col.key)] !== false),
    [columns, columnVisibility],
  )

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const showAllColumns = () => {
    const newVisibility: Record<string, boolean> = {}
    columns.forEach((col) => {
      newVisibility[String(col.key)] = true
    })
    setColumnVisibility(newVisibility)
  }

  const hideAllColumns = () => {
    const newVisibility: Record<string, boolean> = {}
    columns.forEach((col) => {
      newVisibility[String(col.key)] = false
    })
    setColumnVisibility(newVisibility)
  }

  // Refs to header cells for measurement when computing sticky offsets
  const headerCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  // Computed sticky offsets (px) per column key
  const [stickyStyles, setStickyStyles] = useState<
    Record<string, { left?: number; right?: number }>
  >({})

  // Recompute sticky offsets when visible columns change or window resizes
  const visibleKeys = visibleColumns.map((c) => String(c.key)).join(',')

  useEffect(() => {
    const compute = () => {
      const actionsKey = '__actions'
      const actionPinState = columnPinning[actionsKey] ?? 'none'

      const leftPinned = visibleColumns.filter(
        (c) => (columnPinning[String(c.key)] ?? c.pinned) === 'left',
      )
      const rightPinned = visibleColumns.filter(
        (c) => (columnPinning[String(c.key)] ?? c.pinned) === 'right',
      )

      const newStyles: Record<string, { left?: number; right?: number }> = {}

      // Accumulate left offsets in DOM order
      let leftAcc = 0
      for (const col of leftPinned) {
        const key = String(col.key)
        const el = headerCellRefs.current[key]
        const w = el ? Math.ceil(el.getBoundingClientRect().width) : 0
        newStyles[key] = { left: leftAcc }
        leftAcc += w
      }

      if (actionPinState === 'left') {
        newStyles[actionsKey] = { left: leftAcc }
      }

      // Accumulate right offsets in reverse DOM order
      let rightAcc = 0
      for (const col of rightPinned.slice().reverse()) {
        const key = String(col.key)
        const el = headerCellRefs.current[key]
        const w = el ? Math.ceil(el.getBoundingClientRect().width) : 0
        newStyles[key] = { right: rightAcc }
        rightAcc += w
      }

      if (actionPinState === 'right') {
        newStyles[actionsKey] = { right: rightAcc }
      }

      setStickyStyles((prev) => {
        const prevKeys = Object.keys(prev)
        const newKeys = Object.keys(newStyles)
        let changed = false

        if (prevKeys.length !== newKeys.length) {
          changed = true
        } else {
          for (const k of newKeys) {
            const a = prev[k] || {}
            const b = newStyles[k] || {}
            if (a.left !== b.left || a.right !== b.right) {
              changed = true
              break
            }
          }
        }

        return changed ? newStyles : prev
      })
    }

    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [visibleKeys, data.length, showActions, customActions.length, columnPinning, visibleColumns])

  return (
    <Card className={className}>
      {(title || description || enableColumnVisibility) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
          {(title || description) && (
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          )}
          <div className="flex items-center gap-2">
            {enableZoomControl && (
              <div className="flex items-center rounded-md border border-input bg-background shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => changeZoom(-ZOOM_STEP)}
                  disabled={normalizedZoom <= MIN_ZOOM}
                  className="h-8 px-2 text-xs"
                  title="Zoom out"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetZoom}
                  disabled={normalizedZoom === 1}
                  className="h-8 px-2 text-xs font-medium"
                  title="Reset zoom"
                >
                  {Math.round(normalizedZoom * 100)}%
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => changeZoom(ZOOM_STEP)}
                  disabled={normalizedZoom >= MAX_ZOOM}
                  className="h-8 px-2 text-xs"
                  title="Zoom in"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs max-lg:text-sm sm:text-sm"
                    title="Column settings"
                  >
                    <Settings className="h-3 w-3 max-lg:h-4 max-lg:w-4 sm:h-4 sm:w-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      <Trans id="common.columnSettings" />
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-56 max-w-[18rem] max-h-[60vh] overflow-y-auto"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                  }}
                >
                  <div className="px-2 py-1 text-sm font-semibold">
                    <Trans id="common.columnSettings" />
                  </div>
                  <DropdownMenuSeparator />
                  {columns.map((col) => {
                    if (col.alwaysVisible) return null
                    const key = String(col.key)
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={columnVisibility[key] !== false}
                        onCheckedChange={() => toggleColumnVisibility(key)}
                      >
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                  {columns.some((col) => !col.alwaysVisible) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={showAllColumns} className="text-xs max-lg:text-sm">
                        <Trans id="common.showAllColumns" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={hideAllColumns} className="text-xs max-lg:text-sm">
                        <Trans id="common.hideAllColumns" message="Hide All Columns" />
                      </DropdownMenuItem>
                    </>
                  )}
                  {enableColumnPinning && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel inset className="text-xs max-lg:text-sm">
                        <Trans id="common.columnPin" message="Pin Column" />
                      </DropdownMenuLabel>
                      <div className="grid gap-2 px-2 py-1">
                        {columns.map((col) => {
                          if (col.alwaysVisible) return null
                          const key = String(col.key)
                          return (
                            <div
                              key={key}
                              className="rounded-md border border-border bg-popover p-1"
                            >
                              <div className="mb-1 text-xs font-medium max-lg:text-[10px]">
                                {col.label}
                              </div>
                              {(() => {
                                const currentPin = columnPinning[key] ?? 'none'
                                const setPin = (value: 'left' | 'right') => {
                                  setColumnPinning((prev) => ({
                                    ...prev,
                                    [key]: prev[key] === value ? 'none' : value,
                                  }))
                                }
                                return (
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setPin('left')}
                                      className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] max-lg:text-[9px] transition ${
                                        currentPin === 'left'
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
                                      }`}
                                      title="Toggle pin left"
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                      <span>
                                        <Trans id="common.pinLeft" message="Pin Left" />
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPin('right')}
                                      className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] max-lg:text-[9px] transition ${
                                        currentPin === 'right'
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
                                      }`}
                                      title="Toggle pin right"
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                      <span>
                                        <Trans id="common.pinRight" message="Pin Right" />
                                      </span>
                                    </button>
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })}
                        {(showActions || customActions.length > 0) && (
                          <div className="rounded-md border border-border bg-popover p-1">
                            <div className="mb-1 text-xs font-medium max-lg:text-[10px]">
                              <Trans id="common.action" />
                            </div>
                            {(() => {
                              const currentPin = columnPinning['__actions'] ?? 'none'
                              const setPin = (value: 'left' | 'right') => {
                                setColumnPinning((prev) => ({
                                  ...prev,
                                  ['__actions']: prev['__actions'] === value ? 'none' : value,
                                }))
                              }
                              return (
                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPin('left')}
                                    className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] max-lg:text-[9px] transition ${
                                      currentPin === 'left'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                    title="Toggle pin left"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                    <span>
                                      <Trans id="common.pinLeft" />
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPin('right')}
                                    className={`flex items-center justify-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] max-lg:text-[9px] transition ${
                                      currentPin === 'right'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                    title="Toggle pin right"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                    <span>
                                      <Trans id="common.pinRight" />
                                    </span>
                                  </button>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent>
        <div className={`overflow-auto ${maxHeight}`}>
          <div style={zoomStyle}>
            <Table className="text-xs max-lg:text-sm sm:text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {enableRowSelection && (
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={
                          paginatedData.length > 0 &&
                          paginatedData.every((row) => isRowSelected(row))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllVisibleRows()
                          } else {
                            deselectAllVisibleRows()
                          }
                        }}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                  )}
                  {visibleColumns.map((col) => {
                    const key = String(col.key)
                    const pinState = columnPinning[key] ?? col.pinned ?? 'none'
                    const isPinned = pinState === 'left' || pinState === 'right'
                    const sticky = stickyStyles[key]
                    const style: React.CSSProperties | undefined = sticky
                      ? {
                          position: 'sticky',
                          left: sticky.left !== undefined ? `${sticky.left}px` : undefined,
                          right: sticky.right !== undefined ? `${sticky.right}px` : undefined,
                          zIndex: 30,
                        }
                      : undefined

                    return (
                      <TableHead
                        key={key}
                        ref={(el: HTMLTableCellElement | null) => {
                          headerCellRefs.current[key] = el
                        }}
                        style={style}
                        className={`${col.width || ''} ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                              ? 'text-center'
                              : ''
                        } ${isPinned ? 'bg-background sticky' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {isPinned ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] max-lg:text-xs font-medium text-primary">
                              {pinState === 'left' ? (
                                <Trans id="common.pinnedLeft" />
                              ) : (
                                <Trans id="common.pinnedRight" />
                              )}
                            </span>
                          ) : null}
                        </div>
                      </TableHead>
                    )
                  })}
                  {showActions || customActions.length > 0 ? (
                    <TableHead
                      ref={(el: HTMLTableCellElement | null) => {
                        headerCellRefs.current['__actions'] = el
                      }}
                      style={
                        stickyStyles['__actions']
                          ? {
                              position: 'sticky',
                              left:
                                stickyStyles['__actions'].left !== undefined
                                  ? `${stickyStyles['__actions'].left}px`
                                  : undefined,
                              right:
                                stickyStyles['__actions'].right !== undefined
                                  ? `${stickyStyles['__actions'].right}px`
                                  : undefined,
                              zIndex: 30,
                            }
                          : undefined
                      }
                      className={`text-center ${stickyStyles['__actions'] ? 'bg-background sticky' : ''}`}
                    >
                      <Trans id="common.action" />
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={
                        visibleColumns.length +
                        (enableRowSelection ? 1 : 0) +
                        (showActions || customActions.length > 0 ? 1 : 0)
                      }
                      className="h-24 text-center text-muted-foreground"
                    >
                      {emptyStateMessage || <Trans id="common.noDataAvailable" />}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row, idx) => {
                    const rowId = (row as { id?: string | number }).id ?? idx

                    return (
                      <TableRow
                        key={idx}
                        data-testid={`standard-table-row-${rowId}`}
                        onClick={() => {
                          if (enableRowSelection) {
                            toggleRowSelection(row)
                            return
                          }

                          onRowClick?.(row)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return

                          if (enableRowSelection) {
                            event.preventDefault()
                            toggleRowSelection(row)
                            return
                          }

                          onRowClick?.(row)
                        }}
                        tabIndex={enableRowSelection || onRowClick ? 0 : undefined}
                        role={enableRowSelection || onRowClick ? 'button' : undefined}
                        className={`${
                          enableRowSelection || onRowClick
                            ? 'cursor-pointer hover:bg-muted select-none'
                            : ''
                        } ${isRowSelected(row) ? 'bg-muted/50' : ''}`}
                      >
                        {enableRowSelection && (
                          <TableCell className="w-12 text-center">
                            <Checkbox
                              checked={isRowSelected(row)}
                              onCheckedChange={() => toggleRowSelection(row)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Select row"
                            />
                          </TableCell>
                        )}
                        {visibleColumns.map((col) => {
                          const value = row[col.key as keyof T]
                          const align =
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                                ? 'text-center'
                                : ''

                          let cellContent: React.ReactNode

                          if (col.formatter) {
                            cellContent = col.formatter(value, row, locale)
                          } else if (col.type === 'status' && col.statusMap) {
                            const status = col.statusMap[String(value)]
                            cellContent = status ? (
                              <Badge variant={status.variant}>{status.label}</Badge>
                            ) : (
                              String(value ?? '')
                            )
                          } else {
                            cellContent = formatCellValue(value, col.type, col, locale)
                          }

                          const key = String(col.key)
                          const pinState = columnPinning[key] ?? col.pinned ?? 'none'
                          const isPinned = pinState === 'left' || pinState === 'right'
                          const sticky = stickyStyles[key]
                          const cellStyle: React.CSSProperties | undefined = sticky
                            ? {
                                position: 'sticky',
                                left: sticky.left !== undefined ? `${sticky.left}px` : undefined,
                                right: sticky.right !== undefined ? `${sticky.right}px` : undefined,
                                zIndex: 20,
                              }
                            : undefined

                          return (
                            <TableCell
                              key={key}
                              className={`${align} ${isPinned ? 'bg-background sticky' : ''}`}
                              style={cellStyle}
                            >
                              {cellContent}
                            </TableCell>
                          )
                        })}
                        {showActions || customActions.length > 0 ? (
                          <TableCell
                            className={`text-center ${stickyStyles['__actions'] ? 'bg-background' : ''}`}
                            style={
                              stickyStyles['__actions']
                                ? {
                                    position: 'sticky',
                                    left:
                                      stickyStyles['__actions'].left !== undefined
                                        ? `${stickyStyles['__actions'].left}px`
                                        : undefined,
                                    right:
                                      stickyStyles['__actions'].right !== undefined
                                        ? `${stickyStyles['__actions'].right}px`
                                        : undefined,
                                    zIndex: 20,
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-center gap-1">
                              {onEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Edit"
                                  data-testid={`standard-table-edit-${rowId}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(row)
                                  }}
                                  className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete"
                                  data-testid={`standard-table-delete-${rowId}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRowToDelete(row)
                                    setDeleteConfirmationOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 text-destructive max-lg:h-9 max-lg:w-9"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              {customActions.map((action, idx) => (
                                <Button
                                  key={idx}
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    action.onClick(row)
                                  }}
                                  className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                                  title={
                                    typeof action.label === 'string' ? action.label : undefined
                                  }
                                >
                                  {action.icon || action.label}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              {showFooter && data.length > 0 && (
                <TableFooter>
                  <TableRow>
                    {enableRowSelection && <TableCell />}
                    {visibleColumns.map((col) => {
                      let footerContent: React.ReactNode = ''

                      if (col.footerFormatter) {
                        footerContent = col.footerFormatter(data)
                      } else if (col.footerType) {
                        const footerValue = calculateFooterValue(data, col.key, col.footerType)
                        if (footerValue !== null) {
                          footerContent = formatCellValue(footerValue, col.type, col, locale)
                        }
                      }

                      const key = String(col.key)
                      const pinState = columnPinning[key] ?? col.pinned ?? 'none'
                      const isPinned = pinState === 'left' || pinState === 'right'
                      const sticky = stickyStyles[key]
                      const cellStyle: React.CSSProperties | undefined = sticky
                        ? {
                            position: 'sticky',
                            left: sticky.left !== undefined ? `${sticky.left}px` : undefined,
                            right: sticky.right !== undefined ? `${sticky.right}px` : undefined,
                            zIndex: 20,
                          }
                        : undefined

                      return (
                        <TableCell
                          key={key}
                          className={`font-bold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${isPinned ? 'bg-background sticky' : ''}`}
                          style={cellStyle}
                        >
                          {footerContent}
                        </TableCell>
                      )
                    })}
                    {showActions || customActions.length > 0 ? (
                      <TableCell
                        style={
                          stickyStyles['__actions']
                            ? {
                                position: 'sticky',
                                left:
                                  stickyStyles['__actions'].left !== undefined
                                    ? `${stickyStyles['__actions'].left}px`
                                    : undefined,
                                right:
                                  stickyStyles['__actions'].right !== undefined
                                    ? `${stickyStyles['__actions'].right}px`
                                    : undefined,
                                zIndex: 20,
                              }
                            : undefined
                        }
                      />
                    ) : null}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        {/* Pagination Controls */}
        {enablePagination && data.length > 0 && (
          <div className="flex flex-col gap-4 mt-6 pt-4 border-t">
            {/* Items per page - Full width on mobile, inline on larger screens */}
            <div className="flex items-center justify-between sm:justify-start gap-2 text-xs max-lg:text-sm sm:text-sm">
              <span className="text-muted-foreground">
                <span className="sm:hidden">
                  <Trans id="common.itemsPerPageShort" />
                </span>
                <span className="hidden sm:inline">
                  <Trans id="common.itemsPerPage" />
                </span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-16 sm:w-12 h-9 sm:h-8">
                    {itemsPerPage}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {itemsPerPageOptions.map((option) => (
                    <DropdownMenuItem
                      key={option}
                      onClick={() => {
                        setItemsPerPage(option)
                        setCurrentPage(1)
                      }}
                      className={itemsPerPage === option ? 'bg-muted' : ''}
                    >
                      {option}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Page info - Show on mobile */}
              <span className="sm:hidden text-muted-foreground ml-auto text-xs max-lg:text-sm">
                <Trans
                  id="common.paginationInfo"
                  values={{
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, totalItems),
                    total: totalItems,
                  }}
                />
              </span>
            </div>

            {/* Page navigation controls */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap text-xs max-lg:text-sm sm:text-sm">
              {/* Page info - Show on larger screens */}
              <span className="hidden sm:inline text-muted-foreground min-w-max">
                <Trans
                  id="common.paginationInfo"
                  values={{
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, totalItems),
                    total: totalItems,
                  }}
                />
              </span>

              {/* First page button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                title="First page"
              >
                <span className="text-xs max-lg:text-sm">«</span>
              </Button>

              {/* Previous button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page numbers - 3 pages on mobile, 5 on desktop */}
              <div className="flex items-center gap-1 px-1">
                {(() => {
                  // Mobile: show 3 pages max, Desktop: show 5 pages max
                  // Mobile always includes page 1 and nearby pages
                  const maxPagesToShowMobile = 3
                  const maxPagesToShowDesktop = 5

                  let startPage: number
                  let endPage: number

                  // For mobile view (when only 3 pages can be shown)
                  if (totalPages <= maxPagesToShowMobile) {
                    startPage = 1
                    endPage = totalPages
                  } else {
                    // Try to center current page with pages before and after
                    startPage = Math.max(1, currentPage - 1)
                    endPage = Math.min(totalPages, startPage + maxPagesToShowMobile - 1)

                    // Adjust start if end is at the limit
                    if (endPage - startPage + 1 < maxPagesToShowMobile) {
                      startPage = Math.max(1, endPage - maxPagesToShowMobile + 1)
                    }
                  }

                  // Desktop calculation (show 5 pages centered on current page)
                  const desktopStartPage = Math.max(
                    1,
                    currentPage - Math.floor(maxPagesToShowDesktop / 2),
                  )
                  const desktopEndPage = Math.min(
                    totalPages,
                    desktopStartPage + maxPagesToShowDesktop - 1,
                  )

                  // Adjust desktop start if end is at the limit
                  const adjustedDesktopStart =
                    desktopEndPage - desktopStartPage + 1 < maxPagesToShowDesktop
                      ? Math.max(1, desktopEndPage - maxPagesToShowDesktop + 1)
                      : desktopStartPage

                  // Generate mobile page numbers
                  const mobilePageNumbers = Array.from(
                    { length: endPage - startPage + 1 },
                    (_, i) => startPage + i,
                  )

                  // Generate desktop page numbers
                  const desktopPageNumbers = Array.from(
                    { length: desktopEndPage - adjustedDesktopStart + 1 },
                    (_, i) => adjustedDesktopStart + i,
                  )

                  return (
                    <>
                      {/* Mobile pagination - show 3 pages */}
                      <div className="flex items-center gap-1 sm:hidden">
                        {mobilePageNumbers.map((pageNum) => (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="h-8 w-8 p-0 text-xs max-lg:h-9 max-lg:w-9 max-lg:text-sm"
                          >
                            {pageNum}
                          </Button>
                        ))}
                      </div>

                      {/* Desktop pagination - show 5 pages */}
                      <div className="hidden sm:flex items-center gap-1">
                        {desktopPageNumbers.map((pageNum) => (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="h-8 w-8 p-0 text-sm max-lg:h-9 max-lg:w-9 max-lg:text-base"
                          >
                            {pageNum}
                          </Button>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Next button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last page button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 max-lg:h-9 max-lg:w-9"
                title="Last page"
              >
                <span className="text-xs max-lg:text-sm">»</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      {onDelete && deleteConfirmationOpen && (
        <ConfirmDialog
          title={<Trans id="common.deleteConfirm" message="Confirm deletion" />}
          description={
            <Trans
              id="common.deleteConfirmMessage"
              message="Are you sure you want to delete this item? This action cannot be undone."
            />
          }
          confirmLabel={<Trans id="common.delete" message="Delete" />}
          confirmVariant="danger"
          onConfirm={() => {
            if (rowToDelete) {
              onDelete(rowToDelete)
            }
            setDeleteConfirmationOpen(false)
            setRowToDelete(null)
          }}
          onCancel={() => {
            setDeleteConfirmationOpen(false)
            setRowToDelete(null)
          }}
        />
      )}
    </Card>
  )
}
