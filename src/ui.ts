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
  private readonly basketWord = $('basket-word');
  private readonly typeCard = $('type-card');
  private readonly typeGlyph = $('type-glyph');
  private readonly typeName = $('type-name');
  private readonly typeClass = $('type-class');
  private readonly typeNote = $('type-note');
  private lastWordKey = '';
  private lastCardKey = '';
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

  /** Letters in the basket, each rendered in its own typeface. */
  setBasketWord(letters: { glyph: string; fontFamily: string }[]): void {
    const key = letters.map((l) => l.glyph + l.fontFamily).join('|');
    if (key === this.lastWordKey) return;
    this.lastWordKey = key;
    this.basketWord.replaceChildren(
      ...letters.map((l) => {
        const span = document.createElement('span');
        span.textContent = l.glyph;
        span.style.fontFamily = `"${l.fontFamily}", serif`;
        return span;
      }),
    );
  }

  /** Shows the typeface of the letter being held or hovered (null hides it). */
  setTypeCard(info: { glyph: string; fontFamily: string; name: string; classification: string; note: string } | null): void {
    const key = info ? info.glyph + info.name : '';
    if (key === this.lastCardKey) return;
    this.lastCardKey = key;
    this.typeCard.classList.toggle('hidden', !info);
    if (!info) return;
    this.typeGlyph.textContent = info.glyph;
    this.typeGlyph.style.fontFamily = `"${info.fontFamily}", serif`;
    this.typeName.textContent = info.name;
    this.typeClass.textContent = info.classification;
    this.typeNote.textContent = info.note;
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debugPanel.classList.toggle('hidden', !this.debugVisible);
  }

  setDebug(text: string): void {
    this.debugPanel.textContent = text;
  }
}
