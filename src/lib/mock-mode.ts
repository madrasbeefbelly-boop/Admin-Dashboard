const storageKey = 'madras-mock-mode';
const readSetting = () => window.sessionStorage.getItem(storageKey) === 'on';
let enabled = readSetting();

export const isMockMode = () => enabled;

export function switchMockMode() {
  if (enabled) window.sessionStorage.removeItem(storageKey);
  else window.sessionStorage.setItem(storageKey, 'on');

  // Reload so each mode starts with a fresh query cache and page state.
  window.location.reload();
}

export function clearMockMode() {
  window.sessionStorage.removeItem(storageKey);
  enabled = false;
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted && enabled !== readSetting()) window.location.reload();
});
