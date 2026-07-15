/**
 * Metric ↔ imperial conversions for the catch wizard. The DB stores metric
 * (weight_kg, length_cm, depth_m); the UI displays imperial (lb / in / ft)
 * per the catch-log designs.
 */

const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54
const M_PER_FT = 0.3048

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN
}

export function mToFt(m: number): number {
  return m / M_PER_FT
}

export function ftToM(ft: number): number {
  return ft * M_PER_FT
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
