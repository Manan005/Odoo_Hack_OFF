"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
const getSnapshot = () => window.matchMedia(QUERY).matches
const getServerSnapshot = () => false

/**
 * The CSS kill switch in globals.css cannot reach Recharts' JS-driven
 * entrance animations, so chart wrappers read the preference here.
 * Subscription pattern — no state is set inside an effect.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
