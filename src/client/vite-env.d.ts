/// <reference types="vite/client" />

declare module "@json-editor/json-editor" {
  export class JSONEditor {
    constructor(element: HTMLElement, options: Record<string, unknown>);
    getValue(): unknown;
    destroy(): void;
  }
}

declare module "../../web/stopwatch-challenge.js" {
  export function mountStopwatchChallenge(element: HTMLElement): void;
}
