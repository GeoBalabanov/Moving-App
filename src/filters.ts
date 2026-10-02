// One Euro filter (Casiez et al., 2012): an adaptive low-pass filter that
// removes jitter when the signal is slow while keeping lag low when it moves fast.

function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT = 0;

  constructor(
    public minCutoff = 1.0,
    public beta = 0.0,
    public dCutoff = 1.0,
  ) {}

  /** @param t timestamp in seconds */
  filter(value: number, t: number): number {
    if (this.x === null) {
      this.x = value;
      this.lastT = t;
      return value;
    }
    const dt = Math.max(t - this.lastT, 1e-3);
    this.lastT = t;

    const dxRaw = (value - this.x) / dt;
    this.dx += smoothingFactor(dt, this.dCutoff) * (dxRaw - this.dx);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += smoothingFactor(dt, cutoff) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}

export class OneEuroFilter3 {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  private fz: OneEuroFilter;

  constructor(minCutoff = 1.0, beta = 0.0, dCutoff = 1.0) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fz = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  filter(out: { x: number; y: number; z: number }, t: number): void {
    out.x = this.fx.filter(out.x, t);
    out.y = this.fy.filter(out.y, t);
    out.z = this.fz.filter(out.z, t);
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}
