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

export class MultilineBuffer {
  private pending: string[] = [];

  push(line: string) {
    if (!this.pending.length) {
      const startsStack = isStackStart(line);
      if (startsStack) this.pending.push(line);
      return startsStack ? [] : [line];
    }

    if (isStackContinuation(line)) {
      this.pending.push(line);
      return this.pending.length >= 100 ? this.flush() : [];
    }

    this.pending.push(line);
    return this.flush();
  }

  flush() {
    const value = this.pending.join('\n');
    this.pending = [];
    return value ? [value] : [];
  }
}

function isStackStart(line: string) {
  return /^Traceback \(most recent call last\):/.test(line);
}

function isStackContinuation(line: string) {
  return (
    /^\s/.test(line) ||
    /^(?:Traceback \(|During handling of the above exception|The above exception was)/.test(line)
  );
}
