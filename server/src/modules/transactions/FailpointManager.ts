import { FailPoint } from "./transaction.types";

export class PartitionSimulationError extends Error {
  constructor(public readonly stage: FailPoint) {
    super(`Simulated network partition at stage: ${stage}`);
    this.name = "PartitionSimulationError";
  }
}

export class FailpointManager {
  private activeFailPoint: FailPoint | null = null;
  private oneShot = true;

  getAvailableFailPoints(): FailPoint[] {
    return Object.values(FailPoint);
  }

  setFailPoint(failPoint: FailPoint | null, oneShot = true): void {
    this.activeFailPoint = failPoint;
    this.oneShot = oneShot;
  }

  clearFailPoint(): void {
    this.activeFailPoint = null;
    this.oneShot = true;
  }

  getFailPoint(): FailPoint | null {
    return this.activeFailPoint;
  }

  assertNoFailure(stage: FailPoint, requestFailPoint?: FailPoint): void {
    const isRequestScopedHit = requestFailPoint === stage;
    const isGlobalHit = this.activeFailPoint === stage;

    if (!isRequestScopedHit && !isGlobalHit) {
      return;
    }

    /**
     * Allow both global and request-scoped fail points to be one-shot.
     */
    if (isGlobalHit && this.oneShot) {
      this.clearFailPoint();
    }

    throw new PartitionSimulationError(stage);
  }
}

export const failpointManager = new FailpointManager();
