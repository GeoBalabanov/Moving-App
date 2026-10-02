// DOM UI: start/permission overlay, HUD, debug panel and preview status.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class UI {
  readonly sceneCanvas = $<HTMLCanvasElement>('scene');
  readonly video = $<HTMLVideoElement>('webcam');
  readonly previewCanvas = $<HTMLCanvasElement>('preview-canvas');

  private readonly overlay = $('overlay');
  private readonly overlayError = $('overlay-error');
  private readonly btnCamera = $<HTMLButtonElement>('btn-camera');
  private readonly btnMouse = $<HTMLButtonElement>('btn-mouse');
  private readonly basketCount = $('basket-count');
  private readonly hudHint = $('hud-hint');
  private readonly debugPanel = $('debug');
  private readonly preview = $('preview');
  private readonly previewStatus = $('preview-status');
  private lastCount = -1;

  debugVisible = false;

  constructor(handlers: { onCamera: () => void; onMouseOnly: () => void; onReset: () => void; onToggleDebug: () => void }) {
    this.btnCamera.addEventListener('click', handlers.onCamera);
    this.btnMouse.addEventListener('click', handlers.onMouseOnly);
    $('btn-reset').addEventListener('click', (e) => {
      handlers.onReset();
      (e.currentTarget as HTMLElement).blur();
    });
    $('btn-debug').addEventListener('click', (e) => {
      handlers.onToggleDebug();
      (e.currentTarget as HTMLElement).blur();
    });
  }

  setCameraButton(text: string, disabled: boolean): void {
    this.btnCamera.textContent = text;
    this.btnCamera.disabled = disabled;
    this.btnMouse.disabled = disabled;
  }

  showError(message: string): void {
    this.overlayError.textContent = message;
    this.overlayError.classList.remove('hidden');
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }

  showPreview(): void {
    this.preview.classList.remove('hidden');
  }

  setPreviewStatus(text: string): void {
    if (this.previewStatus.textContent !== text) this.previewStatus.textContent = text;
  }

  setHint(text: string): void {
    this.hudHint.textContent = text;
  }

  setBasketCount(n: number): void {
    if (n === this.lastCount) return;
    this.lastCount = n;
    this.basketCount.textContent = String(n);
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debugPanel.classList.toggle('hidden', !this.debugVisible);
  }

  setDebug(text: string): void {
    this.debugPanel.textContent = text;
  }
}
