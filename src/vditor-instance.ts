export interface IVditorInstance {
  init(container: HTMLElement, initialMd: string): Promise<void>
  switchToPreview(): void
  switchToEdit(): void
  getContent(): string
  setContent(md: string): void
  destroy(): void
}
