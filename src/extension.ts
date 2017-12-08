'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
var spawnCMD = require('spawn-command');
var treeKill = require('tree-kill');
import * as history from './history';

var process = null;
var commandOutput = null;
var commandHistory : history.CommandHistory = null;

function run(cmd:string, cwd:string) {
  return new Promise((accept, reject) => {
    var opts : any = {};
    if (vscode.workspace) {
      opts.cwd = cwd;
    }
    process = spawnCMD(cmd, opts);
    function printOutput(data) { commandOutput.append(data.toString()); }
    process.stdout.on('data', printOutput);
    process.stderr.on('data', printOutput);
    process.on('close', (status) => {
      if (status) {
        reject(`Command \`${cmd}\` exited with status code ${status}.`);
      } else {
        accept();
      }
      process = null;
    });
  });
}

function term() {
  treeKill(process.pid, 'SIGTERM', function(err) {
    if (err) {
      vscode.window.showErrorMessage(`Failed to kill process with PID ${process.pid}.`);
    } else {
      process = null;
    }
  });
}

function exec(cmd:string, cwd:string) {
  if (!cmd) { return; }
  commandHistory.enqueue(cmd, cwd);
  commandOutput.clear();
  commandOutput.appendLine(`> Running command \`${cmd}\`...`)
  run(cmd, cwd).then(() => {
    commandOutput.appendLine(`> Command \`${cmd}\` ran successfully.`);
  }).catch((reason) => {
    commandOutput.appendLine(`> ERROR: ${reason}`);
    vscode.window.showErrorMessage(reason, 'Show Output')
      .then((action) => { commandOutput.show(); });
  });
}

function execShellCMD(cwd:string,cmd: string = undefined) {
  if (process) {
    const msg = 'There is an active running shell command right now. Terminate it before executing another shell command.';
    vscode.window.showWarningMessage(msg, 'Terminate')
      .then((choice) => {
        if (choice === 'Terminate') {
          term();
        }
      });
  } else {
    var lastCmd = commandHistory.last();
    var options = {
      placeHolder: 'Type your shell command here.',
      value: lastCmd ? lastCmd.cmd : undefined
    };
    if(cmd === undefined) {
      vscode.window.showInputBox(options).then((cmd) => {
        exec(cmd, cwd);
      });
    } else {
      exec(cmd, cwd);
    }
  }
}

function showHistory() {
  return new Promise((accept, reject) => {
    let items: vscode.QuickPickItem[] = commandHistory.commands().map((cmd) => {
      return { label: cmd.cmd, detail: cmd.cwd, cmd: cmd, description: undefined };
    });
    vscode.window.showQuickPick(items).then((value:any) => {
      if (value) {
        exec(value.cmd.cmd, value.cmd.cwd);
      }
    })
  });
}

export function activate(context: vscode.ExtensionContext) {
  commandHistory = new history.CommandHistory();
  context.subscriptions.push(commandHistory);

  commandOutput = vscode.window.createOutputChannel('Shell');
  context.subscriptions.push(commandOutput);

  let shellCMD = vscode.commands.registerCommand('shell.runCommand', (cmd: string = undefined) => {
    execShellCMD(vscode.workspace.rootPath,cmd);
  });
  context.subscriptions.push(shellCMD);

  let cwdShellCMD = vscode.commands.registerTextEditorCommand('shell.runCommandAtFileLocation', () => {
    if (vscode.window.activeTextEditor.document.uri.scheme !== 'file') {
      vscode.window.showErrorMessage('Current document is not a local file.');
    } else {
      execShellCMD(path.dirname(vscode.window.activeTextEditor.document.uri.fsPath));
    }
  });
  context.subscriptions.push(cwdShellCMD);

  let shellHistory = vscode.commands.registerCommand('shell.showHistory', showHistory)
  context.subscriptions.push(shellHistory);

  let shellTerm = vscode.commands.registerCommand('shell.terminateCommand', () => {
    if (process) {
      term();
    } else {
      vscode.window.showErrorMessage('No running command.')
    }
  })
  context.subscriptions.push(shellTerm);

  let shellOutput = vscode.commands.registerCommand('shell.showCommandLog', () => {
    commandOutput.show();
  })
  context.subscriptions.push(shellOutput);
}

export function deactivate() {
  if (process) {
    treeKill(process.pid, 'SIGTERM', function(err) {
      if (err) {
        treeKill(process.pid, 'SIGKILL');
      }
      process = null;
    });
  }
}
