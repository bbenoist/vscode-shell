'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
var spawnCMD = require('spawn-command');
var treeKill = require('tree-kill');

var process = null;
var commandOutput = null;

function run(cmd:string) {
  return new Promise((accept, reject) => {
    var opts : any = {};
    if (vscode.workspace) {
      opts.cwd = vscode.workspace.rootPath;
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

export function activate(context: vscode.ExtensionContext) {
  commandOutput = vscode.window.createOutputChannel('Shell');
  context.subscriptions.push(commandOutput);

  let shellCMD = vscode.commands.registerCommand('extension.shellCMD', () => {
    if (process) {
      const msg = 'There is an active running shell command right now. Terminate it before executing another shell command.';
      vscode.window.showWarningMessage(msg, 'Terminate')
        .then((choice) => {
          if (choice === 'Terminate') {
            term();
          }
        });
    } else {
      vscode.window.showInputBox({placeHolder: 'Type your shell command here.'}).then(
        (cmd) => {
          if (!cmd) { return; }
          commandOutput.clear();
          commandOutput.appendLine(`> Running command \`${cmd}\`...`)
          run(cmd).then(() => {
            commandOutput.appendLine(`> Command ${cmd} ran successfully.`);
          }).catch((reason) => {
            commandOutput.appendLine(`> ERROR: ${reason}`);
            vscode.window.showErrorMessage(reason, 'Show Output')
              .then((action) => { commandOutput.show(); });
          });
        }
      );
    }
  });
  context.subscriptions.push(shellCMD);

  let shellTerm = vscode.commands.registerCommand('extension.shellTerm', () => {
    if (process) {
      term();
    } else {
      vscode.window.showErrorMessage('No running command.')
    }
  })
  context.subscriptions.push(shellTerm);

  let shellOutput = vscode.commands.registerCommand('extension.shellLog', () => {
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
