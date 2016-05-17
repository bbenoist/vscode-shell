import * as command from './command';

export class CommandHistory {
  private history : command.Command[] = [];

  public dispose() {
  }

  public enqueue(cmd:string, cwd:string) {
    var last = this.last();
    if (last == undefined || (last.cmd !== cmd || last.cwd !== cwd)) {
      this.history.push({cmd:cmd, cwd:cwd});
    }
  }

  public commands() {
    return this.history;
  }

  public last() {
    if (this.history.length == 0) {
      return undefined;
    }
    return this.history[this.history.length - 1];
  }
}
