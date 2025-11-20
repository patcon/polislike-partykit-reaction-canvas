# Polislike Vote Canvas

This is a sample project to show how websockets could be used for reaction to live events, creating polislike data.

## Goals
- Prototype an interface for collecting vote data for sychronous events.
- Prototype an interface that allows for participation without looking at phone.
- Show how presence features can make data collection feels more "collective".
- Provide a rough admin interface for selecting statements.

## Non-Goals
- Will not demo any security or authentication of data.
- Will not do dimensional reduction on the vote data.
- Will not store data to any sort of scalable production database.

__This is a [Partykit](https://partykit.io) project, which lets you create real-time collaborative applications with minimal coding effort.__

This is the **React starter** which pairs a PartyKit server with a React client.

## Technologies Used
- React
- Partykit.io
    - Websockets

## Default Partykit Docs

### Usage

You can start developing by running `npm run dev` and opening [http://localhost:1999](http://localhost:1999) in your browser. When you're ready, you can deploy your application on to the PartyKit cloud with `npm run deploy`.

### Finding your way around

[`party/server.ts`](./party/server.ts) is the server-side code, which is responsible for handling WebSocket events and HTTP requests.

It implements a simple counter that can be incremented by any connected client. The latest state is broadcast to all connected clients.

> [!NOTE]
> The full Server API is available at [Party.Server in the PartyKit docs](https://docs.partykit.io/reference/partyserver-api/)

[`app/client.tsx`](./src/client.ts) is the entrypoint to client-side code.

[`app/components/Counter.tsx`](./src/components/Counter.tsx) connects to the server, sends `increment` events on the WebSocket, and listens for updates.

> [!NOTE]
> The client-side reference can be found at [PartySocket in the PartyKit docs](https://docs.partykit.io/reference/partysocket-api/)

As a client-side React app, the app could be hosted every. During development, for convenience, the server serves the client-side code as well.

This is achieved with the optional `serve` property in the [`partykit.json`](./partykit.json) config file.

> [!NOTE]
> Learn about PartyKit config under [Configuration in the PartyKit docs](https://docs.partykit.io/reference/partykit-configuration/)

### Next Steps

Learn about deploying PartyKit applications in the [Deployment guide of the PartyKit docs](https://docs.partykit.io/guides/deploying-your-partykit-server/).
