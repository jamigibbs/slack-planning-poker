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
- **Administration**:
  - Admin cleanup endpoint for database management
  - Configurable retention period for old sessions
  - Browser and API access options
- **Cold Start**:
  - The bot might take a few seconds to start up on the first request. 
  - A visual "Processing..." message will be shown during start up.
  - Subsequent requests will be much faster

## Usage

1. In any Slack channel where the app is invited, type `/poker [issue]` to start a session
   - You can use a GitHub link, description, or any other text to describe the issue you're estimating.
2. Team members click the voting buttons to submit their estimates
   - Each user can vote once, but can change their vote
   - Emoji reactions will appear on the message to indicate that a vote has been cast
3. When ready, type `/poker-reveal` to show all votes with usernames

## Setup

### Prerequisites

- Node.js and npm/yarn
- A Slack workspace with permission to add apps
- A Supabase account and project
- A hosting service (e.g. Render)

### Supabase Configuration

1. Create a new Supabase project
2. Add the following tables:

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

### Add to a Slack workspace

#### Create a new Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Enter "Planning Poker" as the app name and select your workspace

#### Configure bot permissions

1. In the left sidebar, click on "OAuth & Permissions"
2. Under "Scopes", add these Bot Token Scopes:
  - `commands` (to create slash commands)
  - `reactions:write` (to add emoji reactions)

#### Create slash commands

1. In the left sidebar, click on "Slash Commands"
2. Click "Create New Command"
3. Create two commands:
   - Command: `/poker`
     - Request URL: `https://slack-planning-poker.onrender.com/slack/commands`
     - Short Description: "Start a planning poker session"
     - Usage hint: "[issue link]"
   - Command: `/poker-reveal`    
     - Request URL: `https://slack-planning-poker.onrender.com/slack/commands`
     - Short Description: "Reveal planning poker results"

#### Set up interactivity

1. In the left sidebar, click on "Interactivity & Shortcuts"
2. Toggle "Interactivity" to **On**
3. Set the Request URL to `https://slack-planning-poker.onrender.com/slack/actions`

#### Install the app to your workspace

1. In the left sidebar, click "Install App"
2. Click "Install to [Workspace]"
3. Review permissions and click "Allow"

#### Final steps

- Invite your bot to a channel: `/invite @PlanningPoker`
- Test the bot with `/poker [issue]`
- Vote using the buttons
- Reveal results with `/poker-reveal`

### Local Setup

1. Clone this repository
2. Duplicate `.env.example` as `.env` and set your values:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-key
   PORT=3000
   SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   ADMIN_KEY=your-secure-admin-key
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Start the server:
   ```bash
   yarn start
   ```
5. Use `ngrok` to expose your localhost to Slack:
   ```bash
   ngrok http 3000
   ```
6. Update your Slack App's request URLs with the ngrok URL

## Administration

### Database Cleanup

To manage database size,  you can use the admin cleanup endpoint to remove old sessions and their associated votes.

#### Setup

1. Add an `ADMIN_KEY` to your `.env` file (see Local Setup section)
2. Use one of the following methods to trigger cleanup:

**Browser Method**:
```
https://slack-planning-poker.onrender.com/admin/cleanup?key=your-admin-key&days=30
```

**API Method**:
```bash
curl -X POST https://slack-planning-poker.onrender.com/admin/cleanup \
  -H "Content-Type: application/json" \
  -d '{"key":"your-admin-key","days":30}'
```

The `days` parameter is optional and defaults to 30 if not specified. This determines how many days of sessions to keep (older sessions will be deleted).

## Troubleshooting

- **Missing Reactions**: Make sure your bot has the `reactions:write` scope and is invited to the channel by adding @YourBotName to the channel.
- **Command Not Working**: Verify that your ngrok URL is correctly set in the Slack App settings
- **Database Errors**: Check your Supabase credentials and table structure
