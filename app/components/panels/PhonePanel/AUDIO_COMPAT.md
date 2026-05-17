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

## Known gaps / to investigate

- iOS (Safari, Chrome, Firefox) — no data yet.
- Android Chrome without any BT device connected — confirm "Bluetooth headset"
  entry is absent (expected: only 3 audioinput entries instead of 4).
- Desktop Chrome/Firefox — setSinkId and selectAudioOutput behaviour.
- Whether `devicechange` fires reliably on Android Firefox when BT connects.
