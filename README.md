# Slack Planning Poker

This is a simple Planning Poker tool integrated with Slack and Supabase.

## Features
- Slack slash command `/poker`
- Interactive voting buttons
- Votes stored in Supabase

## Setup

1. Duplicate `.env.example` as `.env` and set your values.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Use `ngrok` to expose your localhost to Slack:

   ```bash
   ngrok http 3000
   ```

5. Configure your Slack App with:

   - Slash Command: `/poker` → `https://your-ngrok-url/slack/commands`
   - Interactivity Endpoint: `https://your-ngrok-url/slack/actions`

## Database Schema (Supabase)

```sql
create table sessions (
  id text primary key,
  channel text,
  issue text
);

create table votes (
  id uuid default uuid_generate_v4() primary key,
  session_id text references sessions(id),
  user_id text,
  vote integer
);
```
