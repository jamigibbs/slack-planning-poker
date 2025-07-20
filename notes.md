# Step 7: Installation Flow
## For New Workspaces:
1. Installation URL: https://yourdomain.com/install
2. User clicks → Redirected to Slack OAuth
3. User authorizes → Redirected to /oauth/callback
4. App saves tokens → Redirected to success page
5. Ready to use in that workspace!

## Add to Slack Button
Create an "Add to Slack" button for your website:

```html
<a href="https://yourdomain.com/install">
  <img alt="Add to Slack" height="40" width="139" 
       src="https://platform.slack-edge.com/img/add_to_slack.png" 
       srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, 
               https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
</a>
```