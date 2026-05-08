import { type App, FuzzySuggestModal, TFolder } from 'obsidian';
import { t } from '@/i18n';

/**
 * Picker for an existing folder inside the current vault.
 *
 * Shows every TFolder, including the vault root (rendered as
 * `(корень vault'а)`). The chosen folder is reported back via the
 * `onChoose` callback as a vault-relative path (`/` for root).
 */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private readonly onChoose: (path: string) => void,
  ) {
    super(app);
    this.setPlaceholder(t('modal.folderSuggest.placeholder'));
  }

  override getItems(): TFolder[] {
    const folders: TFolder[] = [];
    const root = this.app.vault.getRoot();
    const stack: TFolder[] = [root];
    while (stack.length > 0) {
      const folder = stack.pop();
      if (!folder) continue;
      folders.push(folder);
      for (const child of folder.children) {
        if (child instanceof TFolder) stack.push(child);
      }
    }
    return folders;
  }

  override getItemText(folder: TFolder): string {
    const path = folder.path;
    return path === '' || path === '/' ? t('modal.folderSuggest.root') : path;
  }

  override onChooseItem(folder: TFolder): void {
    const path = folder.path === '' ? '/' : folder.path;
    this.onChoose(path);
  }
}
