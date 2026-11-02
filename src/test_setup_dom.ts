/**
 * Глобальная инициализация DOM для тестирования React в Node.js / JSDOM.
 * Выполняется строго до загрузки react-dom.
 */
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

export const win = dom.window;

Object.defineProperty(globalThis, 'window', { value: win, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: win.document, writable: true, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, writable: true, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: win.localStorage, writable: true, configurable: true });

// Global DOM constructors
Object.defineProperty(globalThis, 'Node', { value: win.Node, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Element', { value: win.Element, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLElement', { value: win.HTMLElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLInputElement', { value: win.HTMLInputElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: win.HTMLTextAreaElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLButtonElement', { value: win.HTMLButtonElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLFormElement', { value: win.HTMLFormElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: win.HTMLSelectElement, writable: true, configurable: true });
Object.defineProperty(globalThis, 'Event', { value: win.Event, writable: true, configurable: true });
Object.defineProperty(globalThis, 'MouseEvent', { value: win.MouseEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'KeyboardEvent', { value: win.KeyboardEvent, writable: true, configurable: true });
Object.defineProperty(globalThis, 'CustomEvent', { value: win.CustomEvent, writable: true, configurable: true });

// matchMedia mock
win.matchMedia = win.matchMedia || function (query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
};

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
