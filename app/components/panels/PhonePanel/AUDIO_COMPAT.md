# Audio Device Compatibility Notes

Real-world `enumerateDevices()` observations collected via the in-panel copy button.
Update this file whenever new data is available. Used to keep the doc block in
`index.tsx` grounded in observed behaviour rather than spec assumptions.

---

## Android Chrome 148 — Pixel (Android 10)

```
platform: android-chrome
userAgent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36
setSinkId: no
selectAudioOutput: no
external audio: yes
selected sink: (none)

audioinput devices (4):
  [unknown] Default — default
  [speaker] Speakerphone — 173d43b9e6802222...
  [earpiece] Headset earpiece — dd7b378749caaf0c...
  [bluetooth] Bluetooth headset — be7f85264a3ea770...

audiooutput devices (1):
  [unknown] Default — default
```

**Observations (BT earpiece was connected during this capture):**
- `setSinkId` not supported — no way to select output sink from the browser.
- `audiooutput` exposes only a single "Default" entry with no useful label; not
  actionable for routing decisions.
- `audioinput` is the useful side: "Bluetooth headset" entry is present because
  BT was connected. Confirmed to appear/disappear with BT connection state —
  this is the reliable external-audio detection signal on Android Chrome.
- "Speakerphone" and "Headset earpiece" are always-present phantom routing modes
  from `AudioManagerAndroid.java` (indices 0 and 2 in its fixed device array),
  not real connectable hardware. Do not treat them as headset signals.
- "Default" (deviceId `default`) appears as both an audioinput and an audiooutput
  entry; its label gives no routing information.

---

## Android Firefox 150 (Android 16)

```
platform: android-firefox
userAgent: Mozilla/5.0 (Android 16; Mobile; rv:150.0) Gecko/150.0 Firefox/150.0
setSinkId: no
selectAudioOutput: no
external audio: no
selected sink: (none)

audioinput devices (1):
  [unknown] Default audio input device — 4x6wSmiK5pH+4+HesLMVhhYnDWIHEz84N9xaJicpqC8=

audiooutput devices (0):
```

**Observations (BT earpiece was connected during this capture):**
- `setSinkId` not supported.
- Only a single generic "Default audio input device" in audioinput — no routing
  mode breakdown, and crucially no bluetooth device entry despite BT being active.
- Zero audiooutput devices returned.
- **Firefox Android cannot detect connected BT devices via enumerateDevices().**
  The `external audio: no` result here is a false negative — BT was connected
  but invisible to the API. Our speakerphone warning will always trigger on
  Android Firefox regardless of headphone state, which is the wrong behaviour
  but unavoidable until Firefox fixes device enumeration on Android.
- Consistent with the long-standing Firefox Android audio label bug:
  https://bugzilla.mozilla.org/show_bug.cgi?id=1681772

---

## Android Opera 98 (Android 10) — Chromium-based

```
platform: android-chrome
userAgent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36 OPR/98.0.0.0
setSinkId: no
selectAudioOutput: no
external audio: yes
selected sink: (none)

audioinput devices (4):
  [unknown] Default — default
  [speaker] Speakerphone — 7dd875cb37d771d8...
  [earpiece] Headset earpiece — be310aa4cbd44f9f...
  [bluetooth] Bluetooth headset — ff6e856b6cc3e994...

audiooutput devices (1):
  [unknown] Default — default
```

**Observations (BT earpiece was connected during this capture):**
- Identical behaviour to Android Chrome — Opera on Android uses the Chromium
  engine and the same `AudioManagerAndroid.java` device layer.
- UA contains `OPR/98.0.0.0` but our platform detection correctly classifies
  it as `android-chrome` (matches `Chrome/` and not `Firefox/` or `EdgA/`),
  which is appropriate since the audio API behaviour is identical.
- "Bluetooth headset" appears in audioinput when BT is connected — same
  reliable detection signal as Chrome.

---

## Android Edge 148 (Android 10) — Chromium-based

```
platform: android-edge  ← was android-other before platform detection was fixed
userAgent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36 EdgA/148.0.0.0
setSinkId: no
selectAudioOutput: no
external audio: yes
selected sink: (none)

audioinput devices (4):
  [unknown] Default — default
  [speaker] Speakerphone — 3136799fe07495ab...
  [earpiece] Headset earpiece — f413d970352497...
  [bluetooth] Bluetooth headset — a2f79523b5d28e...

audiooutput devices (1):
  [unknown] Default — default
```

**Observations (BT earpiece was connected during this capture):**
- Identical behaviour to Android Chrome — Edge on Android uses the Chromium
  engine and the same `AudioManagerAndroid.java` device layer.
- UA contains `EdgA/148.0.0.0`; platform detection now correctly labels it
  `android-edge` (previously fell through to `android-other` because `EdgA`
  was excluded from `isChrome` but had no dedicated branch).
- "Bluetooth headset" appears in audioinput when BT is connected — same
  reliable detection signal as Chrome and Opera.

---

## Android Brave (Android 10) — Chromium-based

```
platform: android-chrome
userAgent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36
setSinkId: no
selectAudioOutput: no
external audio: yes
selected sink: (none)

audioinput devices (4):
  [unknown] Default — default
  [speaker] Speakerphone — aec755a762f2cf22...
  [earpiece] Headset earpiece — 580945982978438...
  [bluetooth] Bluetooth headset — ca53db0013380df...

audiooutput devices (1):
  [unknown] Default — default
```

**Observations (BT earpiece was connected during this capture):**
- Identical behaviour to Android Chrome.
- Brave strips its own UA token entirely — the UA is indistinguishable from
  stock Chrome. Platform detection correctly labels it `android-chrome` and
  there is no way to tell them apart, nor any need to.

---

## Android Firefox Nightly 152 (Android 16) — BT attached

```
platform: android-firefox
userAgent: Mozilla/5.0 (Android 16; Mobile; rv:152.0) Gecko/152.0 Firefox/152.0
setSinkId: no
selectAudioOutput: no
external audio: no
selected sink: (none)

audioinput devices (1):
  [unknown] Default audio input device — 3balnXRUyRF1bHe9aIaomK1PzCSg1VLGJfiexufAJZw=

audiooutput devices (0):
```

**Observations (BT earpiece was connected during this capture):**
- Identical to stable Firefox 150 — Nightly shows no improvement in device
  enumeration. BT device invisible despite being connected.
- Confirms this is a persistent engine-level limitation, not a versioning fluke.

---

## Android Chrome Canary 150 (Android 10) — BT attached

```
platform: android-chrome
userAgent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36
setSinkId: no
selectAudioOutput: no
external audio: yes
selected sink: (none)

audioinput devices (4):
  [unknown] Default — default
  [speaker] Speakerphone — f9737a9ffb05eadc...
  [earpiece] Headset earpiece — 3128d6ea37b978f2...
  [bluetooth] Bluetooth headset — d1b25bc69197f40c...

audiooutput devices (1):
  [unknown] Default — default
```

**Observations (BT earpiece was connected during this capture):**
- Identical to stable Chrome 148. No changes in Canary for device enumeration.

---

## Desktop Chrome 148 — MacBook Pro (macOS)

```
timestamp: 2026-05-17T21:18:00.318Z
platform: desktop
userAgent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36
setSinkId: yes
selectAudioOutput: no
external audio: yes
devicechange events: 0
selected sink: (none)
active mic track: MacBook Pro Microphone (Built-in)

audioinput devices (5):
  [unknown] MacBook Pro Microphone (Built-in)
  [unknown] BlackHole 2ch (Virtual)
  [unknown] VB-Cable (Virtual)
  [unknown] ZoomAudioDevice (Virtual)
  [unknown] Default - MacBook Pro Microphone (Built-in) — default

audiooutput devices (6):
  [speaker] Default - MacBook Pro Speakers (Built-in) — default
  [unknown] BlackHole 2ch (Virtual)
  [speaker] MacBook Pro Speakers (Built-in)
  [unknown] VB-Cable (Virtual)
  [unknown] ZoomAudioDevice (Virtual)
  [headset] Blackhole + headphones (Aggregate)
```

**Observations:**
- `setSinkId: yes` — desktop Chrome supports output device selection, unlike Android.
- `selectAudioOutput: no` — Chrome-specific; this API is Firefox Desktop only.
- Desktop enumerates all system audio devices with full labels — virtual devices
  (BlackHole, VB-Cable, ZoomAudioDevice) and macOS aggregate devices all appear.
- `active mic track: MacBook Pro Microphone (Built-in)` confirms Chrome selected
  the built-in mic, not one of the virtual devices, when getUserMedia resolved.
- `external audio: yes` here is a **false positive**: "Blackhole + headphones
  (Aggregate)" is a custom macOS Audio MIDI Setup aggregate device, not a real
  connected headset. Our `headset` classifier matched "headphones" in the label.
  This is an inherent limitation of label-based detection on desktop — virtual
  and aggregate devices can accidentally match headset keywords. The warning is
  only shown on Android so this doesn't affect users in practice, but worth
  knowing if detection is ever extended to desktop.

---

## iOS Chrome 147 (iOS 18) — Chrome for iOS uses WebKit, same as Safari

```
timestamp: 2026-05-17T21:16:45.573Z
platform: ios
userAgent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/147.0.7727.99 Mobile/15E148 Safari/604.1
setSinkId: no
selectAudioOutput: no
external audio: no
devicechange events: 0
selected sink: (none)
active mic track: iPhone Microphone

audioinput devices (1):
  [unknown] iPhone Microphone — A1828EF806C7C78D7FCCDA316612A89472D00236

audiooutput devices (0):
```

**Observations:**
- All iOS browsers (Chrome, Safari, Firefox) use WebKit under the hood — this
  data is representative of all of them.
- Only 1 audioinput ("iPhone Microphone"), 0 audiooutput — iOS does not expose
  BT audio devices via enumerateDevices regardless of connection state. The OS
  handles routing automatically and keeps it opaque to the web layer.
- `external audio: no` is always expected on iOS, even with BT connected — this
  is why we skip the speakerphone warning entirely on iOS rather than showing a
  false alarm.
- No phantom routing modes like Android — iOS WebKit does not expose Speakerphone
  or Headset Earpiece as separate virtual devices.
- `active mic track: iPhone Microphone` — single built-in mic, no ambiguity.

---

## Known gaps / to investigate

- Android Chrome without any BT device connected — confirm "Bluetooth headset"
  entry is absent (expected: only 3 audioinput entries instead of 4).
- Desktop Firefox — setSinkId and selectAudioOutput behaviour; does
  selectAudioOutput() actually appear in the debug panel?
- Whether `devicechange` fires reliably on Android Firefox when BT connects
  (use the devicechange counter in the debug panel to check).
