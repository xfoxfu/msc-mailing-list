export {};

declare global {
  interface Env {
    MAILGUN_TOKEN: string;
    JWT_SECRET: string;
  }

  interface WebSocket {
    accept(): void;
  }

  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }

  interface ResponseInit {
    webSocket?: WebSocket;
  }
}
