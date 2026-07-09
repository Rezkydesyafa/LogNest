export class LineBuffer {
  private pending = '';

  push(chunk: Buffer | string) {
    this.pending += chunk.toString();
    const lines = this.pending.split(/\r?\n/);
    this.pending = lines.pop() ?? '';
    return lines.filter(Boolean);
  }

  flush() {
    const line = this.pending;
    this.pending = '';
    return line ? [line] : [];
  }
}
