// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ChatGPTAPI } from "./chatgpt";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const provider = new ChatGPTViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatGPTViewProvider.viewType,
      provider
    )
  );

  let disposable2 = vscode.commands.registerCommand("chatgpt.ask", () => {
    vscode.window
      .showInputBox({ prompt: "What do you want to do?" })
      .then((value) => {
        provider.search(value ?? "");
      });
  });
  context.subscriptions.push(disposable2);
}

class ChatGPTViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "chatgpt.chatView";

  private _view?: vscode.WebviewView;

  /**
   * You can set this to "true" once you have authenticated within the headless chrome.
   */
  private _chatGPTAPI = new ChatGPTAPI({
    headless: false,
  });

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      // Check if the data type is "codeSelected"
      if (data.type === "codeSelected") {
        let code = data.value;
        code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");

        vscode.window.activeTextEditor?.insertSnippet(
          new vscode.SnippetString(code)
        );
      }
      // Check if the data type is "prompt"
      else if (data.type === "prompt") {
        this.search(data.value ?? "");
      }
      // If the data type does not match either of the above cases, handle it as "some other message"
      else {
        console.log("some other message");
      }
    });
  }

  public async search(prompt: string) {
    const isSignedIn = await this._chatGPTAPI.getIsSignedIn();
    if (!isSignedIn) {
      await this._chatGPTAPI.init();
    }

    const languageId = vscode.window.activeTextEditor?.document.languageId;
    const surroundingText = vscode.window.activeTextEditor?.document.getText();

    // get the selected text
    const selection = vscode.window.activeTextEditor?.selection;
    const selectedText =
      vscode.window.activeTextEditor?.document.getText(selection);
    let searchPrompt = "";

    if (selection && selectedText) {
      searchPrompt = `${selectedText}

	${prompt}`;
    } else {
      searchPrompt = `This is the ${languageId} file I'm working on:
	${surroundingText}

	${prompt}`;
    }

    console.log(searchPrompt);

    const response = await this._chatGPTAPI.sendMessage(searchPrompt);

    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: "addResponse", value: response });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script src="  https://unpkg.com/showdown/dist/showdown.min.js"></script>
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body>
        <h1 class="mb-2">Type your question:</h1>
				<input class="h-10 w-full text-white bg-stone-700 p-4 text-sm" 
          type="text" id="prompt-input" />
        <div class="flex gap-x-1 mt-2">
          <button class="bg-blue-800 rounded px-2 py-1 hover:bg-blue-900 text-sm text-gray-100" 
            id="explain-code-btn">Explain code</button>
          <button class="bg-blue-800 rounded px-2 py-1 hover:bg-blue-900 text-sm text-gray-100" 
            id="explain-code-btn">Fix bugs</button>
        </div>
				<div id="response" class="pt-4 text-lg">
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
