// Minimal ambient types for the Bun APIs used by the desktop build. @types/bun is
// avoided because it conflicts with @types/node.
interface BunBlob {
  readonly type: string;
  readonly size: number;
  slice(start?: number, end?: number): BunBlob;
  arrayBuffer(): Promise<ArrayBuffer>;
}
declare const Bun: { file(path: string): BunBlob };
