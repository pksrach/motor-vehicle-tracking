'use client'

import { useCallback, useSyncExternalStore } from 'react'

const storageChangeEvent = 'local-storage-change'
const snapshotCache = new Map<string, { rawValue: string | null; value: unknown }>()

function subscribeToStorage(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', onStoreChange)
  window.addEventListener(storageChangeEvent, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(storageChangeEvent, onStoreChange)
  }
}

function readStoredValue<T>(key: string, initialValue: T): T {
  try {
    const rawValue = window.localStorage.getItem(key)
    const cached = snapshotCache.get(key)
    if (cached?.rawValue === rawValue) return cached.value as T

    const value = rawValue === null ? initialValue : JSON.parse(rawValue)
    snapshotCache.set(key, { rawValue, value })
    return value
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error)
    return initialValue
  }
}

/**
 * Custom hook for managing local storage
 * Syncs state with localStorage and handles SSR/hydration safely
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const getSnapshot = useCallback(() => readStoredValue(key, initialValue), [key, initialValue])
  const getServerSnapshot = useCallback(() => initialValue, [initialValue])
  const storedValue = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot)
  const isHydrated = useSyncExternalStore(
    subscribeToStorage,
    () => true,
    () => false,
  )

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const currentValue = readStoredValue(key, initialValue)
        const valueToStore = value instanceof Function ? value(currentValue) : value
        const rawValue = JSON.stringify(valueToStore)
        if (rawValue === undefined) {
          throw new TypeError(`Value for localStorage key "${key}" is not serializable`)
        }

        window.localStorage.setItem(key, rawValue)
        snapshotCache.set(key, { rawValue, value: valueToStore })
        window.dispatchEvent(new Event(storageChangeEvent))
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [initialValue, key],
  )

  return [storedValue, setValue, isHydrated] as const
}
