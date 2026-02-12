import { loadSettings, saveSettings, type UserSettings } from '../shared/settings';

async function initPopup(): Promise<void> {
  // Display version
  const versionEl = document.getElementById('version');
  if (versionEl) {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = `v${manifest.version}`;
  }

  // Load and bind settings
  const settings = await loadSettings();

  const toggleKeys: (keyof UserSettings)[] = [
    'showSpeed',
    'showLoop',
    'keyboardShortcuts',
  ];

  for (const key of toggleKeys) {
    const el = document.getElementById(key) as HTMLInputElement | null;
    if (!el) continue;
    el.checked = settings[key] as boolean;
    el.addEventListener('change', () => {
      saveSettings({ [key]: el.checked });
    });
  }
}

initPopup();
