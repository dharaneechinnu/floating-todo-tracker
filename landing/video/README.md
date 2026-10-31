# FocusDock launch film

`landing/public/launch-video.mp4` (1920×1080, 30 fps, H.264 + AAC stereo, about 1:24) and its poster
`landing/public/launch-poster.jpg` are what the landing page's "See it in 90 seconds" section plays.
`npm run build` copies both into `../docs/` for the GitHub Pages fallback. Chapter times in
`src/components/LaunchVideo.jsx` match the timestamps below; update them together if the film is re-cut.

How it was made:

- **Visuals**: kinetic HTML/CSS/SVG scenes on a light background with FocusDock orange as the hero colour.
  They use spring/overshoot motion, a bubble → pill → panel shape morph, circle and wipe reveals between
  scenes, confetti bursts, camera push-ins and light motion blur on fast moves.
  Icons are [Lucide](https://lucide.dev) (ISC licence), inlined as SVG with draw-on strokes.
  The people are flat illustrated SVG characters drawn for the film, not real people.
  Frames are rendered with Playwright (Chromium) at 1.5× device scale and assembled with ffmpeg.
  Every beat has burned-in captions, so it works with the sound off.
- **Voice**: [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) open-weight neural TTS, voice `af_heart`
  at 1.1× speed, one clip per beat. Scene lengths are cut to each clip.
- **Sound**: synthesized SFX (whooshes on transitions; pops, clicks and key taps on UI moments; a ding on
  timer completion and copy) placed at cue points the scenes emit.
  The music bed is an upbeat 118 BPM I–V–vi–IV groove, ducked about 11 dB under the voice.
  The final mix is loudness-normalised to about -15 LUFS.

If a product change makes a beat inaccurate, re-cut the film instead of letting it drift.

## Narration script

| Time | Beat | Line |
|---|---|---|
| 0:00 | Problem | Your todo list? It's buried. Somewhere behind twelve windows, and a tab you closed hours ago. |
| 0:07 | Problem | So you switch apps just to check it. Your flow? Gone. And at standup, you're scrambling to remember what you did yesterday. |
| 0:16 | What it is | Meet FocusDock. A tiny bubble that floats on top of every window, on every desktop. |
| 0:23 | Why it's different | Drag it to any edge, and it docks right there, peeking out just enough. Always in reach. Never in the way. |
| 0:31 | Why it's different | And it's local first. No account. No server. No tracking. Your work stays on your machine. |
| 0:38 | Who it's for | It's built for engineers. Pull requests, blockers, and that standup, every single morning. |
| 0:45 | Walkthrough | Click the bubble, and your list opens right where it sits. Type to search. Hit enter to add. |
| 0:52 | Walkthrough | Tag the PR. Flag what's blocked. Set a priority, and a due date. Everything, at a glance. |
| 0:59 | Walkthrough | Hit play for a focus session. Every one you finish earns that task a tomato. |
| 1:06 | Walkthrough (standup) | Then at standup, one click builds your report. Tasks, collaborations, and blockers, copied and ready to paste. |
| 1:15 | Call to action | FocusDock. Free for Windows and Linux. Download it today, and never lose your list again. |
