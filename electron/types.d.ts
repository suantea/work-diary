declare module 'screenshot-desktop' {
  interface Options {
    format?: 'png' | 'jpg'
    screen?: string | number
    filename?: string
    quality?: number
  }
  function screenshot(options?: Options): Promise<Buffer>
  export = screenshot
}
