import Alpine from "alpinejs";

declare global {
  interface Window {
    Alpine?: any;
    __ALPINE_STARTED__?: boolean;
  }
}

window.Alpine = Alpine;

if (!window.__ALPINE_STARTED__) {
  Alpine.start();
  window.__ALPINE_STARTED__ = true;
}
