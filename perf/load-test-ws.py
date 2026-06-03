#!/usr/bin/env python3
# /// script
# dependencies = ["websockets"]
# ///
"""
Custom WebSocket load test for the PartyKit reaction canvas.

Simulates N concurrent users each sending cursor move/touch events
at a realistic rate, then prints a summary of results.

Usage:
  uv run perf/load-test-ws.py
  uv run perf/load-test-ws.py --users 50 --duration 30 --url ws://localhost:1999/party/default
  uv run perf/load-test-ws.py --url wss://whispering-gallery-staging.patcon.partykit.dev/party/perf-test

Target environments:
  Local:   ws://localhost:1999/party/default
  Staging: wss://whispering-gallery-staging.patcon.partykit.dev/party/perf-test
"""

import asyncio
import json
import math
import random
import time
import argparse
import uuid
from dataclasses import dataclass, field
from typing import Optional
import websockets
from websockets.exceptions import ConnectionClosed


# --- Config defaults ---
DEFAULT_URL      = "ws://localhost:1999/party/default"
DEFAULT_USERS    = 50
DEFAULT_DURATION = 30     # seconds
MOVE_INTERVAL    = 0.033  # ~30 fps, matches realistic pointer rate
RAMP_DURATION    = 5.0    # seconds to ramp up all users


@dataclass
class UserStats:
    user_id: str
    connected: bool = False
    messages_sent: int = 0
    messages_received: int = 0
    connect_time_ms: Optional[float] = None
    errors: list = field(default_factory=list)


def generate_uuid() -> str:
    return str(uuid.uuid4())


@dataclass
class CircleOrbit:
    """Deterministic circular path for one virtual user."""
    cx: float      # center x (0–100)
    cy: float      # center y (0–100)
    r: float       # radius (canvas %)
    omega: float   # angular velocity (radians/second)
    phase: float   # starting angle (radians)

    @classmethod
    def random(cls) -> "CircleOrbit":
        r = random.uniform(5, 30)
        # keep center far enough from edges that the circle stays on canvas
        cx = random.uniform(r, 100 - r)
        cy = random.uniform(r, 100 - r)
        # speed: 0.3–1.5 full rotations per second (rapid thumb on touchscreen)
        omega = random.uniform(0.3, 1.5) * 2 * math.pi
        return cls(cx=cx, cy=cy, r=r, omega=omega, phase=random.uniform(0, 2 * math.pi))

    def position(self, t: float) -> tuple[float, float]:
        angle = self.omega * t + self.phase
        return (
            round(self.cx + self.r * math.cos(angle), 2),
            round(self.cy + self.r * math.sin(angle), 2),
        )


def make_cursor_event(user_id: str, orbit: CircleOrbit, t: float, event_type: str = "move") -> str:
    x, y = orbit.position(t)
    return json.dumps({
        "type": event_type,
        "position": {
            "x": x,
            "y": y,
            "timestamp": int(time.time() * 1000),
            "userId": user_id,
        }
    })


def make_remove_event(user_id: str) -> str:
    return json.dumps({
        "type": "remove",
        "position": {
            "x": 0,
            "y": 0,
            "timestamp": int(time.time() * 1000),
            "userId": user_id,
        }
    })


async def run_user(url: str, duration: float, stats: UserStats) -> None:
    orbit = CircleOrbit.random()
    t0 = time.perf_counter()
    try:
        async with websockets.connect(url, open_timeout=10) as ws:
            stats.connect_time_ms = (time.perf_counter() - t0) * 1000
            stats.connected = True

            # listener task — count incoming messages
            async def listen():
                try:
                    async for _ in ws:
                        stats.messages_received += 1
                except ConnectionClosed:
                    pass

            listener = asyncio.create_task(listen())

            # sender loop — emit cursor events until duration expires
            deadline = t0 + duration
            while time.perf_counter() < deadline:
                t = time.perf_counter() - t0
                event_type = "touch" if random.random() < 0.1 else "move"
                await ws.send(make_cursor_event(stats.user_id, orbit, t, event_type))
                stats.messages_sent += 1
                await asyncio.sleep(MOVE_INTERVAL)

            # clean disconnect
            await ws.send(make_remove_event(stats.user_id))
            listener.cancel()
            try:
                await listener
            except asyncio.CancelledError:
                pass

    except Exception as e:
        stats.errors.append(str(e))


async def main(url: str, num_users: int, duration: float) -> None:
    print(f"Target:   {url}")
    print(f"Users:    {num_users}")
    print(f"Duration: {duration}s  (ramp: {RAMP_DURATION}s)")
    print(f"Rate/user: ~{1/MOVE_INTERVAL:.0f} msg/s")
    print()

    all_stats = [UserStats(user_id=generate_uuid()) for _ in range(num_users)]

    # stagger connection starts across ramp window
    ramp_step = RAMP_DURATION / num_users if num_users > 1 else 0

    tasks = []
    for i, stats in enumerate(all_stats):
        delay = i * ramp_step
        async def spawn(s=stats, d=delay):
            if d > 0:
                await asyncio.sleep(d)
            await run_user(url, duration, s)
        tasks.append(asyncio.create_task(spawn()))

    print(f"Ramping up {num_users} users over {RAMP_DURATION}s...")
    t_start = time.perf_counter()
    await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - t_start

    # --- Summary ---
    connected     = [s for s in all_stats if s.connected]
    failed        = [s for s in all_stats if not s.connected]
    connect_times = [s.connect_time_ms for s in connected if s.connect_time_ms is not None]
    total_sent    = sum(s.messages_sent for s in connected)
    total_recv    = sum(s.messages_received for s in connected)

    print()
    print("=" * 50)
    print("RESULTS")
    print("=" * 50)
    print(f"Elapsed:          {elapsed:.1f}s")
    print(f"Connections:      {len(connected)}/{num_users} succeeded")
    if failed:
        print(f"Failures:         {len(failed)}")
        for s in failed[:5]:
            print(f"  {s.user_id[:8]}: {s.errors[-1] if s.errors else 'unknown'}")

    if connect_times:
        connect_times.sort()
        print(f"Connect time (ms):")
        print(f"  min={connect_times[0]:.1f}  "
              f"p50={connect_times[len(connect_times)//2]:.1f}  "
              f"p95={connect_times[int(len(connect_times)*0.95)]:.1f}  "
              f"max={connect_times[-1]:.1f}")

    if connected:
        msgs_sent_list = sorted(s.messages_sent for s in connected)
        print(f"Messages sent:    {total_sent:,} total  "
              f"(~{total_sent/elapsed:.0f}/s aggregate)")
        print(f"  per user: min={msgs_sent_list[0]}  "
              f"p50={msgs_sent_list[len(msgs_sent_list)//2]}  "
              f"max={msgs_sent_list[-1]}")
        print(f"Messages received:{total_recv:,} total  "
              f"(~{total_recv/elapsed:.0f}/s aggregate)")
        fanout = total_recv / total_sent if total_sent else 0
        print(f"  fanout ratio:   {fanout:.1f}x  "
              f"(expected ~{len(connected)-1}x for full broadcast)")
    print("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PartyKit WebSocket load test")
    parser.add_argument("--url",      default=DEFAULT_URL,      help="WebSocket URL")
    parser.add_argument("--users",    type=int, default=DEFAULT_USERS,    help="Concurrent users")
    parser.add_argument("--duration", type=float, default=DEFAULT_DURATION, help="Test duration (seconds)")
    args = parser.parse_args()

    asyncio.run(main(args.url, args.users, args.duration))
