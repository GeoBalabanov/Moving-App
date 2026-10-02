// Shared tuning constants. Units are metres / seconds unless noted.

export const CAMERA = {
  position: [0, 1.6, 2.6] as const,
  lookAt: [0, 1.0, -1.0] as const,
  fov: 55,
};

export const STORE = {
  shelfUnitXs: [-1.65, 0, 1.65],
  shelfUnitZ: -1.4,
  shelfWidth: 1.5,
  shelfDepth: 0.45,
  /** Top surface heights of the shelf boards products rest on. */
  shelfLevels: [0.16, 0.58, 1.0, 1.42],
  shelfTop: 1.85,
  boardThickness: 0.03,
  panelThickness: 0.04,
  /** Limits for where a held letter can be carried (the aisle in front of the display). */
  backWallZ: -1.8,
  sideWallX: 2.65,
  /** Invisible wall just behind the camera. */
  frontWallZ: 3.2,
};

/** The visible store around the interactive aisle. */
export const ROOM = {
  halfWidth: 7.5,
  backZ: -10,
  frontZ: 3.4,
  height: 3.6,
};

/** The stocked gondolas that form the aisle you stand in. */
export const AISLE = {
  gondolaX: 3.0,
  gondolaDepth: 0.6,
  gondolaHeight: 1.9,
  startZ: -1.75,
  endZ: 3.3,
};

export const COUNTER = {
  center: [0.5, 0, 0.75] as const,
  size: [1.0, 0.4, 0.5] as const,
};

export const BASKET = {
  /** Inner size of the basket (x, height, z). */
  inner: [0.56, 0.22, 0.36] as const,
  wall: 0.02,
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
  distNear: 1.5,
  /** Just in front of the shelf backs, so the hand never disappears behind the display. */
  distFar: 4.1,
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
