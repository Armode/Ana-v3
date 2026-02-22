<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ana-v3 — Gemini 3 Pro Chat Interface

A real-time AI chat application powered by **Gemini 3 Pro**, built with React and TypeScript. It features streaming responses, Google Search grounding, source citations, dynamic UI mood control, and per-session memory cores.

View your app in AI Studio: https://ai.studio/apps/1ec679ab-912e-4bbe-a910-0565ce8bfd13

## Features

- **Streaming Responses** — Tokens are streamed in real time as Gemini generates them, giving an immediate and fluid chat experience.
- **Google Search Grounding** — The model can call Google Search to ground factual answers. When sources are used, a *Sources & Citations* section is rendered beneath the message with clickable links.
- **Dynamic Mood / Theme** — Ana can switch the UI between **dark** and **light** themes mid-conversation using the `set_mood` tool, responding to the emotional tone of the chat.
- **Memory Cores** — Each chat session maintains its own context. The sidebar displays an animated *Memory Cores* indicator that reflects active session state.
- **Multiple Chat Sessions** — Create, switch between, and delete independent conversations from the sidebar.
- **Markdown & Code Rendering** — Responses support full Markdown (headings, lists, blockquotes, bold/italic) and syntax-highlighted code blocks via highlight.js.
- **Display Settings** — Adjust message density (Comfortable / Compact) and chat width (Standard / Wide / Full) via the settings panel in the header.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run lint` | Type-check the project with TypeScript (`tsc --noEmit`) |
| `npm run preview` | Preview the production build locally |
