import * as vscode from "vscode";
const { v4: uuidv4 } = require('uuid');

import { getExtensionUri } from "../../context";
import { callAI, getChatModelList } from "./langchain-tools";
import { channel } from "../../channel";

type WebviewEvent = {
  id: string;
  type: string;
  data: any;
  reply: (data: unknown) => void;
};

export class AutoDevWebviewProtocol {
  private _onMessage = new vscode.EventEmitter<any>();
  _webview: vscode.Webview;
  _webviewListener?: vscode.Disposable;

  get onMessage() {
    return this._onMessage.event;
  }

  constructor(webview: vscode.Webview) {
    this._webview = webview;

    webview.onDidReceiveMessage((message) => {
      const messageId = message && message.messageId;
      const messageType = message && message.messageType;
      if (!(messageId || messageType)) {
        return;
      }

      channel.appendLine(`Received message: ${messageType}`);

      const reply = (data: unknown) => {
        this._webview.postMessage({
          messageId: messageId,
          messageType: "onLoad",
          data: JSON.stringify(data),
        });
      };

      switch (messageType) {
        case "getOpenFiles":
          this.getOpenFiles({
            id: messageId,
            type: messageType,
            data: message.data,
            reply,
          });
          break;
        case "onLoad":
          this.onLoad({
            id: messageId,
            type: messageType,
            data: message.data,
            reply,
          });
          break;
        case "config/getBrowserSerialized":
          this.getBrowserSerialized({
            id: messageId,
            type: messageType,
            data: message.data,
            reply,
          });
          break;
        // case "history/save"
        case "llm/streamChat":
          this.streamChat({
            id: messageId,
            type: messageType,
            data: message.data,
            reply,
          });
          break;
        default:
          console.log("unknown mesaage type: %s", messageType);
      }
    });
  }

  onLoad({ reply }: WebviewEvent) {
    reply({
      windowId: "1",
      serverUrl: "",
      workspacePaths: [],
      vscMachineId: "1111",
      vscMediaUrl: getExtensionUri().toString(),
    });
  }

  getOpenFiles({ reply }: WebviewEvent) {
    reply([]);
  }

  // See continue BrowserSerializedContinueConfig
  getBrowserSerialized({ reply }: WebviewEvent) {
    reply({
      models: getChatModelList(),
      // contextProviders: [],
      // disableIndexing: false,
      // disableSessionTitles: false,
      allowAnonymousTelemetry: false,
    });
  }

  async streamChat({ data, reply }: WebviewEvent) {
    console.log("streamChat", JSON.stringify(data));

    try {
      const completion = await callAI(data);

      if (!completion) {
        reply({ content: "暂不支持此模型的使用" });
        reply({ done: true });
        return;
      }

      for await (const chunk of completion) {
        reply({
          content: chunk.content,
        });
      }
    } catch (err) {
      reply({
        content: `Error: ${(err as Error).message}`,
      });
    } finally {
      reply({
        done: true,
      });
    }
  }

  private send(messageType: string, data: any, messageId?: string): string {
    const id = messageId ?? uuidv4();
    channel.appendLine(`Sending message: ${messageType}`);
    this._webview?.postMessage({
      messageType,
      data,
      messageId: id,
    });
    return id;
  }

  request(messageType: string, data: any) {
    const messageId = uuidv4();
    return new Promise((resolve) => {
      if (!this._webview) {
        resolve(undefined);
        return;
      }

      this.send(messageType, data, messageId);
      const disposable = this._webview.onDidReceiveMessage(
        (msg: Message<any>) => {
          if (msg.messageId === messageId) {
            resolve(msg.data);
            disposable?.dispose();
          }
        },
      );
    });
  }
}

export interface Message<T = any> {
  messageType: string;
  messageId: string;
  data: T;
}

export type WebviewProtocol = {
  newSessionWithPrompt: [{ prompt: string }, void];
  getTerminalContents: [undefined, string];
};
