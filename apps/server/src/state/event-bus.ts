import type { Response } from "express";
import type { ArcadeEvent } from "../types";

const clients = new Set<Response>();
const replayBuffer: ArcadeEvent[] = [];
const maxReplayEvents = 100;

export function addEventClient(res: Response) {
  clients.add(res);

  res.write("retry: 2000\n\n");
  for (const event of replayBuffer.slice(-20)) {
    writeEvent(res, event);
  }

  res.on("close", () => {
    clients.delete(res);
  });
}

export function publish(event: ArcadeEvent) {
  replayBuffer.push(event);
  if (replayBuffer.length > maxReplayEvents) {
    replayBuffer.shift();
  }

  for (const client of clients) {
    writeEvent(client, event);
  }
}

function writeEvent(res: Response, event: ArcadeEvent) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
