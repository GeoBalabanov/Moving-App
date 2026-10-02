// Webcam capture + MediaPipe HandLandmarker (VIDEO mode) + the mirrored
// landmark preview drawn in the corner of the screen.

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { TRACKING } from './config';

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_PATH = `${import.meta.env.BASE_URL}models/hand_landmarker.task`;

export type Handedness = 'Left' | 'Right';

export interface DetectedHand {
  /** The user's actual hand (already corrected for MediaPipe's selfie assumption). */
  handedness: Handedness;
  score: number;
  /** Normalised image landmarks in raw (un-mirrored) camera space. */
  landmarks: NormalizedLandmark[];
}

export class CameraError extends Error {
  constructor(
    message: string,
    public readonly kind: 'denied' | 'notfound' | 'insecure' | 'busy' | 'unknown',
  ) {
    super(message);
  }
}

/** Ask for webcam access and start the stream on the given <video>. */
export async function startWebcam(video: HTMLVideoElement): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError(
      'Camera access needs a secure context. Open the app via http://localhost (not a LAN IP) or HTTPS.',
      'insecure',
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('This browser does not support webcam access.', 'notfound');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraError(
        'Camera permission was denied. Allow camera access for this site in your browser settings (and in macOS System Settings → Privacy & Security → Camera), then reload.',
        'denied',
      );
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new CameraError('No webcam was found on this device.', 'notfound');
    }
    if (name === 'NotReadableError') {
      throw new CameraError('The webcam is busy — close other apps using it (Zoom, FaceTime…) and try again.', 'busy');
    }
    throw new CameraError(`Could not start the webcam: ${(err as Error)?.message ?? err}`, 'unknown');
  }
  video.srcObject = stream;
  await video.play();
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => video.addEventListener('loadeddata', () => resolve(), { once: true }));
  }
  return stream;
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTime = -1;
  private frameCounter = 0;
  /** Exponential moving average of detection time in ms. */
  detectMs = 0;
  /** Detections per second actually executed. */
  detectFps = 0;
  private detectCount = 0;
  private detectFpsWindowStart = performance.now();
  latest: DetectedHand[] = [];

  constructor(private readonly video: HTMLVideoElement) {}

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO' as const,
      numHands: TRACKING.numHands,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (err) {
      console.warn('GPU delegate unavailable, falling back to CPU', err);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
    }
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Run detection if a new video frame is available. Returns true when fresh
   * results were produced this call. When detection is slow it only runs
   * every other render frame so rendering stays smooth.
   */
  update(nowMs: number): boolean {
    if (!this.landmarker || this.video.readyState < 2) return false;
    if (this.video.currentTime === this.lastVideoTime) return false;
    this.frameCounter++;
    if (this.detectMs > TRACKING.slowDetectionMs && this.frameCounter % 2 === 1) return false;

    this.lastVideoTime = this.video.currentTime;
    const t0 = performance.now();
    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(this.video, nowMs);
    } catch (err) {
      console.error('Hand detection failed', err);
      return false;
    }
    const dt = performance.now() - t0;
    this.detectMs = this.detectMs === 0 ? dt : this.detectMs * 0.9 + dt * 0.1;

    this.detectCount++;
    if (t0 - this.detectFpsWindowStart >= 1000) {
      this.detectFps = (this.detectCount * 1000) / (t0 - this.detectFpsWindowStart);
      this.detectCount = 0;
      this.detectFpsWindowStart = t0;
    }

    this.latest = parseResult(result);
    return true;
  }
}

function parseResult(result: HandLandmarkerResult): DetectedHand[] {
  const hands: DetectedHand[] = result.landmarks.map((landmarks, i) => {
    const cat = result.handedness[i]?.[0];
    // We feed the raw (un-mirrored) camera frame; verified against test
    // footage, the label then matches the user's actual hand.
    const label: Handedness = cat?.categoryName === 'Left' ? 'Left' : 'Right';
    return { handedness: label, score: cat?.score ?? 0, landmarks };
  });

  // Two hands with the same label happens occasionally — disambiguate by
  // position. In the raw (un-mirrored) image the user's right hand has the smaller x.
  if (hands.length === 2 && hands[0].handedness === hands[1].handedness) {
    const [a, b] = hands;
    const aIsRight = a.landmarks[0].x < b.landmarks[0].x;
    a.handedness = aIsRight ? 'Right' : 'Left';
    b.handedness = aIsRight ? 'Left' : 'Right';
  }
  return hands;
}

export const HAND_COLORS: Record<Handedness, string> = {
  Left: '#3fc5ff',
  Right: '#ff7a45',
};

/** Draws the mirrored webcam image plus landmark skeletons into a small canvas. */
export class PreviewRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(hands: DetectedHand[], pinching: Partial<Record<Handedness, boolean>>): void {
    const { video, canvas, ctx } = this;
    if (video.videoWidth === 0) return;
    const w = 320;
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1); // mirror so it behaves like a mirror
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    for (const hand of hands) {
      const color = HAND_COLORS[hand.handedness];
      const px = (i: number) => (1 - hand.landmarks[i].x) * w;
      const py = (i: number) => hand.landmarks[i].y * h;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
        ctx.moveTo(px(start), py(start));
        ctx.lineTo(px(end), py(end));
      }
      ctx.stroke();

      ctx.fillStyle = '#fff';
      for (let i = 0; i < hand.landmarks.length; i++) {
        ctx.beginPath();
        ctx.arc(px(i), py(i), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pinching[hand.handedness]) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc((px(4) + px(8)) / 2, (py(4) + py(8)) / 2, 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(hand.handedness, px(0) - 12, py(0) + 16);
    }
  }
}
