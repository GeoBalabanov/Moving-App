// Shared tuning constants. Units are metres / seconds unless noted.

export const CAMERA = {
  position: [0, 1.62, 3.55] as const,
  lookAt: [0, 1.15, -4] as const,
  fov: 58,
};

/**
 * The aisle you stand in, looking down its length (towards -z). Shelving
 * ("gondolas") runs along both sides; the front faces sit at ±frontX.
 */
export const AISLE = {
  frontX: 1.2,
  depth: 0.55,
  /** Near end (towards the camera) and far end of the shelving. */
  startZ: 2.7,
  endZ: -13,
  /** Top surfaces of the shelf boards. */
  levels: [0.14, 0.54, 0.94, 1.34, 1.74],
  height: 2.12,
  board: 0.025,
  /** The type bays: nearest shelving on each side, split into two bays. */
  typeBays: [
    [1.1, -0.5],
    [-0.5, -2.1],
  ] as const,
  /** Shelf levels (indices into `levels`) that hold letters in a type bay, top to bottom. */
  typeLevels: [3, 2, 1] as const,
};

export const ROOM = {
  halfWidth: 4.6,
  backZ: -15,
  frontZ: 4.2,
  height: 3.5,
};

/** Where a held letter can be carried. */
export const REACH = {
  halfWidth: AISLE.frontX - 0.05,
  minZ: AISLE.endZ,
  maxZ: 3.3,
};

/** First-person shopping cart in front of the camera; letters dropped in it count. */
export const CART = {
  center: [0, 0, 1.95] as const,
  /** Inner basket size (x, height, z) and the height of its floor. */
  inner: [0.52, 0.38, 0.9] as const,
  floorY: 0.58,
  wall: 0.012,
};

export const HAND_MAPPING = {
  /** Expand the usable webcam area so you can reach screen edges without leaving the frame. */
  gain: 1.3,
  /**
   * Starting guess for the apparent hand size (wrist → middle-finger knuckle,
   * as a fraction of the image height) at the "far" and "near" ends of your
   * reach. The range auto-calibrates: it widens to the smallest/largest sizes
   * it sees and slowly relaxes back, so it adapts to your camera and seat.
   */
  sizeFar: 0.1,
  sizeNear: 0.24,
  /** Smallest size range the calibration may shrink to (keeps depth from being twitchy). */
  minSizeRange: 0.07,
  /** Distance from the virtual camera along the view axis at each end of the range. */
  distNear: 1.1,
  /** Far enough to reach the second type bay; the aisle is open beyond it. */
  distFar: 5.8,
  /**
   * true  → moving your hand toward the screen reaches deeper into the aisle
   *         (feels like reaching through a window). Toggle in-app with I.
   * false → a bigger hand in the image is closer to the virtual camera.
   */
  reachIn: true,
  /** World-space length of the wrist → middle knuckle segment (slightly larger than life so it reads on screen). */
  palmLength: 0.17,
  /** How long a hand may vanish from tracking before we treat it as gone (ms). */
  lostTimeoutMs: 300,
};

export const PINCH = {
  /** Thumb–index distance divided by palm length. Below `grab` → pinch starts. */
  grab: 0.32,
  /** Above `release` → pinch ends. The gap between the two is the hysteresis. */
  release: 0.5,
};

export const INTERACTION = {
  /** Max distance from the pinch point to a product's surface for it to be grabbable. */
  grabRadius: 0.16,
  /** Multiplier applied to hand velocity on release. */
  throwScale: 1.0,
  maxThrowSpeed: 6,
  /** Window of hand history used to estimate release velocity (ms). */
  velocityWindowMs: 100,
};

export const PHYSICS = {
  timestep: 1 / 60,
  maxSubsteps: 4,
  gravity: -9.81,
};

export const TRACKING = {
  numHands: 2,
  /** If detection is slower than this (EMA, ms), run it every other frame. */
  slowDetectionMs: 18,
};
