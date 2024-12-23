import { WebClient } from '@slack/web-api';

const slackToken = process.env.SLACK_TOKEN;
const slackClient = new WebClient(slackToken);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const payload = JSON.parse(req.body);

      // ボタンが押されたときの処理
      const { actions, user } = payload;
      if (actions && actions.length > 0) {
        const selectedAction = actions[0].value;
        await updateUserStatus(user.id, selectedAction, ':smile:');
        res.status(200).send('Status updated');
      } else {
        res.status(400).send('No actions found');
      }
    } catch (error) {
      console.error('Error processing Slack interaction:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}

// ユーザーのステータスを更新する関数
async function updateUserStatus(userId, statusText, emoji) {
  try {
    await slackClient.users.profile.set({
      user: userId,
      profile: {
        status_text: statusText,
        status_emoji: emoji,
      },
    });
    console.log('Status updated:', userId);
  } catch (error) {
    console.error('Error updating status:', error);
  }
}
