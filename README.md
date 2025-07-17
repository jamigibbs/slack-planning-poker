# Slack Planning Poker

A simple, interactive Planning Poker tool integrated with Slack and Supabase for agile estimation in your team channels.

## Features

- **Two Slash Commands**:
  - `/poker [issue]` - Start a new planning poker session with the specified issue
  - `/poker-reveal` - Reveal the results of the latest planning poker session
- **Interactive Voting**:
  - Persistent voting buttons that remain visible until results are revealed
  - Users can update their votes without creating duplicates
  - Visual emoji reactions shows how many have voted
- **Results Display**:
  - Votes are displayed with usernames when revealed
  - Clear vote distribution with counts and voters
- **Data Storage**:
  - All votes and sessions stored in Supabase
  - Session history maintained per channel

## Setup

### Prerequisites

- Node.js and npm
- A Slack workspace with permission to add apps
- A Supabase account and project

### Supabase Configuration

1. Create a new Supabase project
2. Set up the following tables:

   **sessions**
   ```sql
   create table sessions (
     id text primary key,
     channel text not null,
     issue text not null,
     created_at timestamp with time zone default now()
   );
   ```

   **votes**
   ```sql
   create table votes (
     id serial primary key,
     session_id text not null references sessions(id),
     user_id text not null,
     vote integer not null,
     username text,
     unique(session_id, user_id)
   );
   ```

### Slack App Configuration

1. Create a new Slack App at https://api.slack.com/apps
2. Under "Slash Commands", create two commands:
   - Command: `/poker`
     - Request URL: `https://your-domain.com/slack/commands`
     - Short Description: "Start a planning poker session"
   - Command: `/poker-reveal`
     - Request URL: `https://your-domain.com/slack/commands`
     - Short Description: "Reveal planning poker results"
3. Under "Interactivity & Shortcuts":
   - Turn on Interactivity
   - Set Request URL to `https://your-domain.com/slack/actions`
4. Under "OAuth & Permissions":
   - Add the following Bot Token Scopes:
     - `commands`
     - `chat:write`
     - `reactions:write`
   - Install the app to your workspace
   - Copy the "Bot User OAuth Token" for your `.env` file

### Local Setup

1. Clone this repository
2. Duplicate `.env.example` as `.env` and set your values:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-key
   PORT=3000
   SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Use `ngrok` to expose your localhost to Slack:
   ```bash
   ngrok http 3000
   ```
6. Update your Slack App's request URLs with the ngrok URL

## Usage

1. In any Slack channel where the app is installed, type `/poker [issue]` to start a session
   - You can use a GitHub link, description, or any other text to describe the issue you're estimating.
2. Team members click the voting buttons to submit their estimates
   - Each user can vote once, but can change their vote
   - Emoji reactions will appear on the message to indicate that a vote has been cast
3. When ready, type `/poker-reveal` to show all votes with usernames

## Troubleshooting

- **Missing Reactions**: Make sure your bot has the `reactions:write` scope and is invited to the channel by adding @YourBotName to the channel.
- **Command Not Working**: Verify that your ngrok URL is correctly set in the Slack App settings
- **Database Errors**: Check your Supabase credentials and table structure
