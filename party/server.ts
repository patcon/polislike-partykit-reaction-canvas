import type * as Party from "partykit/server";

export default class Server implements Party.Server {
  count = 0;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    // send the current count to the new client
    conn.send(this.count.toString());
  }

  onMessage(message: string, sender: Party.Connection) {
    // let's log the message
    console.log(`connection ${sender.id} sent message: ${message}`);
    // we could use a more sophisticated protocol here, such as JSON
    // in the message data, but for simplicity we just use a string
    if (message === "increment") {
      this.increment();
    }
  }

  onRequest(req: Party.Request) {
    // response to any HTTP request (any method, any path) with the current
    // count. This allows us to use SSR to give components an initial value

    // if the request is a POST, increment the count
    if (req.method === "POST") {
      this.increment();
    }

    return new Response(this.count.toString());
  }

  increment() {
    this.count = (this.count + 1) % 100;
    // broadcast the new count to all clients
    this.room.broadcast(this.count.toString(), []);
  }
}

Server satisfies Party.Worker;
