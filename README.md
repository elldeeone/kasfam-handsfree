# Handsfree GPT-5.1 CLI

Ask GPT-5.1 anything from your terminal using the official OpenAI JavaScript SDK and a custom system prompt.

## Prerequisites

- Node.js 18+
- An OpenAI API key with access to GPT-5.1

## Setup

```bash
npm install
```

Set your API key (add this to your shell profile for convenience):

```bash
export OPENAI_API_KEY="sk-your-key"
```

(Optional) Provide a default custom prompt:

```bash
export CUSTOM_PROMPT="You are an enthusiastic travel guide."
```

## Usage

### Development mode (TypeScript directly)

```bash
npm run dev -- --prompt "You are a Python tutor." --question "Why is async IO helpful?"
```

### Build and run compiled output

```bash
npm run build
npm start -- --prompt "Summarize like a journalist" "Give me today's top ML headline"
```

Command-line options:

- `-q, --question <text>` Question to send (you can also append the question after the options)
- `-p, --prompt <text>` Custom system prompt/instructions (overrides `CUSTOM_PROMPT`)
- `-h, --help` Show inline usage info

The script prints the model's answer to stdout and falls back to dumping the raw response if no text output is available.
