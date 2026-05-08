/**
 * Minimal Obsidian API mock for Jest. Only the surface area the plugin
 * actually uses gets stubbed here — extend as new symbols are needed.
 *
 * Real plugin code never imports from this file directly; jest.config maps
 * `import 'obsidian'` to it.
 */

export class Plugin {
  app: unknown;
  manifest: unknown;
  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  async onload(): Promise<void> {}
  async onunload(): Promise<void> {}
  async loadData(): Promise<unknown> {
    return null;
  }
  async saveData(_data: unknown): Promise<void> {}
  addCommand(_command: unknown): unknown {
    return _command;
  }
  addSettingTab(_tab: unknown): void {}
  addStatusBarItem(): HTMLElement {
    return {} as HTMLElement;
  }
  registerEvent(_event: unknown): void {}
}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: HTMLElement = {} as HTMLElement;
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }
  display(): void {}
  hide(): void {}
}

export class Modal {
  app: unknown;
  contentEl: HTMLElement = {} as HTMLElement;
  constructor(app: unknown) {
    this.app = app;
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
}

export class TFolder {
  path = '';
  name = '';
  children: Array<TFile | TFolder> = [];
}

export const requestUrl = jest.fn();
export const setIcon = jest.fn();
export const debounce = <T extends (...args: never[]) => unknown>(fn: T, _wait: number): T => fn;
