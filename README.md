# Slack Planning Poker

**Overview**

This bot does two simple things:

1. It asks the channel to give anonymous estimates for a provided issue with `/poker [issue or description]`. Channel members select a number (1, 2, 3, 5, or 8).
2. It displays the results of the voting with `/poker-reveal`

That's it. There are no extra setup steps or setup involved.

After revealing the results, the team can discuss them and make a final estimate decision together. By hiding the figures during voting, the group avoids the cognitive bias of anchoring, where the first number spoken aloud sets a precedent for subsequent estimates.

This process also encourages team collaborations and encourages further discussion of the issue especially if significant variation between estimates are revealed.

**The Nitty Gritty**

- There can only be one active voting session in a channel at a time. This is intentional. 
- Teams vote together and discuss the results together. This app is not meant to be used asynchronously.
- If the votes are revealed before everyone is done, that's ok! A session doesn't end until a new one is started using `/poker [issue]`.
- If someone votes again, their last vote is simply updated. Running `/poker-reveal` again will show the updated votes.


## Features

- **Two Slash Commands**:
  - `/poker [issue]` - Start a new planning poker session with the specified issue
  - `/poker-reveal` - Reveal the results of the latest planning poker session
- **Interactive Voting**:
  - Persistent voting buttons that remain visible until results are revealed
  - Users can update their votes without creating duplicates
  - Contextual feedback: "Your vote has been recorded" vs "Your vote has been updated"
  - Visual emoji reactions show when someone has voted including when they update their vote
- **Results Display**:
  - Votes displayed with usernames and clear distribution when revealed
  - Rich, professional formatting using Slack's Block Kit
  - Colored borders for visual appeal and better readability
- **Data Storage**:
  - All votes and sessions stored in Supabase
  - Session history maintained per channel
- **Technical Features**:
  - Comprehensive test coverage (82%+ for core controllers)
  - Row-level security with Supabase for data protection
  - Centralized logging system for better debugging
  - Enhanced error handling and user feedback
  - OAuth integration for secure workspace installations

## Usage

1. In any Slack channel where the app is invited, type `/poker [issue]` to start a session
   - You can use a GitHub link, description, or any other text to describe the issue you're estimating.
2. Team members click the voting buttons to submit their estimates
   - Each user can only vote once, but can change their vote
   - Users receive contextual feedback: "Your vote has been recorded" or "Your vote has been updated"
   - Emoji reactions will appear on the message to indicate that a vote has been cast or updated
3. When ready, type `/poker-reveal` to show all votes with usernames

## Development Setup

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
     created_at timestamp with time zone default now()
   );
   ```

   **team_installations**
   ```sql
   create table team_installations (
     id serial primary key,
     team_id text not null unique,
     bot_token text not null,
     access_token text not null,
     scope text not null,
     team_name text,
     bot_user_id text,
     app_id text,
     installer_user_id text,
     installed_at timestamp with time zone,
     created_at timestamp with time zone default now(),
     updated_at timestamp with time zone default now()
   );
   ```

### Hosting provider

- Add the project to a hosting service (e.g. Render)

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
  - `chat:write` (to send messages and responses)
  - `reactions:write` (to add emoji reactions)
  - `channels:read` (to access public channel information)
  - `groups:read` (to access private channel information)
  - `im:read` (to access direct message information)
  - `mpim:read` (to access multi-party direct message information)

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

## Data Retention

The app implements a 30-day data retention policy as stated in the privacy policy. To ensure this policy is enforced, a scheduled job has been created to automatically delete data older than the specified retention period (default: 30 days).

### Setting up the Data Retention Job on Render

1. In your Render dashboard, create a new **Cron Job** service:
   - Click on "New" and select "Cron Job"
   - Connect to your GitHub repository
   - Name: `slack-planning-poker-data-retention`
   - Schedule: `0 0 * * *` (runs daily at midnight)
   - Command: `node src/jobs/index.js dataRetention`
   - Note: You can specify a custom retention period by setting the `RETENTION_DAYS` environment variable (e.g., `RETENTION_DAYS=45` for 45-day retention)
   - Environment Variables: Add the same environment variables as your web service, including:
     - `SUPABASE_URL`
     - `SUPABASE_KEY`

2. Configure the job:
   - Set the appropriate environment
   - Set the branch to deploy from (e.g., `main`)
   - Click "Create Cron Job"

The job will automatically run daily and delete any votes and sessions that are older than the specified retention period, in compliance with the app's data retention policy.

### Running the Data Retention Job Manually

You can also run the data retention job manually from the terminal with either the default 30-day retention period or a custom period:

1. Make sure your environment variables are set up correctly:
   ```bash
   # Set your Supabase credentials
   export SUPABASE_URL=your_supabase_url
   export SUPABASE_KEY=your_supabase_key
   ```

2. Run the job with the default 30-day retention period:
   ```bash
   node src/jobs/index.js dataRetention
   ```

3. Run the job with a custom retention period (e.g., 45 days):
   ```bash
   # Set custom retention period
   export RETENTION_DAYS=45
   node src/jobs/index.js dataRetention
   ```

4. Or run the specific job file directly with a custom retention period:
   ```bash
   node -e "require('./src/jobs/dataRetention').cleanupOldData(45)"
   ```

This is useful for testing the job before deploying it to Render or for one-time cleanup operations.

## Administration

### Database Management

The application includes an automated data retention job that periodically removes old sessions and their associated votes to manage database size. This job runs on a schedule defined in your environment configuration.

You can configure the retention period by setting the `RETENTION_DAYS` environment variable (defaults to 30 days if not specified).
