export interface UserSettings {
  showSpeed: boolean;
  showLoop: boolean;
  keyboardShortcuts: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  showSpeed: true,
  showLoop: true,
  keyboardShortcuts: true,
};

let cached: UserSettings = { ...DEFAULT_SETTINGS };

export async function loadSettings(): Promise<UserSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return cached;
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result: { settings?: Partial<UserSettings> }) => {
      if (result.settings) {
        cached = { ...DEFAULT_SETTINGS, ...result.settings };
      }
      resolve(cached);
    });
  });
}

/** Synchronous access to cached settings (for hot-path use in content script). */
export function getSettings(): UserSettings {
  return cached;
}

export async function saveSettings(partial: Partial<UserSettings>): Promise<void> {
  cached = { ...cached, ...partial };
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set({ settings: cached });
  }
}

/** Listen for settings changes from popup/options page. */
export function watchSettingsChanges(onChanged: (settings: UserSettings) => void): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes['settings']?.newValue) {
      cached = { ...DEFAULT_SETTINGS, ...(changes['settings'].newValue as Partial<UserSettings>) };
      onChanged(cached);
    }
  });
}
