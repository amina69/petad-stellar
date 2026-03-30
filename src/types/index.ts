export type Percentage = number;

export function asPercentage(value: number): Percentage {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`Percentage must be between 0 and 100, got ${value}`);
  }
  return value;
}

export enum EscrowStatus {
  CREATED = "CREATED",
  FUNDED = "FUNDED",
  DISPUTED = "DISPUTED",
  SETTLING = "SETTLING",
  SETTLED = "SETTLED",
  NOT_FOUND = "NOT_FOUND",
}