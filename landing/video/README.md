# Launch film

`landing/public/launch-video.mp4` (1280×720, 30 fps, H.264 + AAC, ~1:26) and its poster
`landing/public/launch-poster.jpg` are what the landing page's "See it in 90 seconds" section plays.
`npm run build` copies both into `../docs/` for the GitHub Pages fallback.

How it was made:

- **Visuals**: HTML/CSS scenes that recreate the bubble and panel from `src/styles.css`, rendered frame by frame
  with Playwright (Chromium) and assembled with ffmpeg. Every scene has a headline and burned-in subtitles, so it
  works with the sound off.
- **Voice**: [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) open-weight neural TTS, voice `af_heart`,
  one clip per beat. Scene lengths were cut to match each clip.
- **Music**: a soft synthesized pad (Cmaj7 → Am7 → Fmaj7 → G), ducked under the voice. Loudness-normalised to about -16 LUFS.

If you change the product in a way that makes a beat inaccurate, re-cut the film instead of letting it drift.

## Narration script

| Time | Beat | Line |
|---|---|---|
| 0:00 | Problem | Your todo list lives in a browser tab you closed two hours ago. Or in an app, buried behind twelve other windows. |
| 0:08 | Problem | So you switch context just to check it, you lose your flow, and at standup, you scramble to remember what you actually did yesterday. |
| 0:16 | What it is | Meet Floating Todo Tracker. A tiny bubble that floats on top of every window, on every virtual desktop. |
| 0:23 | Why it's different | Drag it to any edge of the screen, and it docks there, peeking out just enough to reach. It never covers your work, and it's impossible to forget. |
| 0:32 | Why it's different | It's local first. No account, no server, no telemetry. Your tasks never leave your machine. |
| 0:39 | Who it's for | And it's built for engineers tracking real work: pull requests, blockers, and the standup you have every single morning. |
| 0:47 | Walkthrough | Click the bubble, and your list opens right where it sits. Start typing to search. Press enter to add. |
| 0:54 | Walkthrough | Tag a task with its PR number, flag it as blocked, and set a priority and a due date. Everything you need, at a glance. |
| 1:02 | Walkthrough | Hit play to start a focus timer. Every finished session earns that task a tomato. |
| 1:08 | Walkthrough | And when you log off, one click builds your status report, with your tasks, collaborations, and blockers, and copies it straight to your clipboard. |
| 1:18 | Call to action | Floating Todo Tracker. Free for Windows and Linux. Download it today, and never lose your list again. |
