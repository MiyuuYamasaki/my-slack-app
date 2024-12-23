import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import bodyParser from 'body-parser';

// Slackのトークンを環境変数から取得
const slackToken = process.env.SLACK_TOKEN;
const slackClient = new WebClient(slackToken);
const botToken = process.env.BOT_TOKEN;
const botClient = new WebClient(botToken);

slackClient.auth
  .test()
  .then((response) => {
    console.log('Token is valid:', response);
  })
  .catch((error) => {
    console.error('Error testing token:', error);
  });

// Slackインタラクションのペイロードの型定義
type SlackInteractionPayload = {
  actions: { name: string; value: string }[];
  user: { id: string };
};

export const config = {
  api: {
    bodyParser: false, // デフォルトのbodyParserを無効にしてカスタムで処理
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      // リクエストボディをurlencodedとして解析
      const parsedBody = await new Promise<SlackInteractionPayload>(
        (resolve, reject) => {
          bodyParser.urlencoded({ extended: true })(req, res, (err) => {
            if (err) reject(err);
            resolve(JSON.parse(req.body.payload)); // Slackから送られてくるデータは "payload" フィールドに含まれる
          });
        }
      );

      // ボタンが押されたときの処理
      const { actions, user } = parsedBody;
      if (actions && actions.length > 0) {
        const selectedAction = actions[0].value;
        let emoji = '';
        switch (selectedAction) {
          case 'office':
            emoji = ':office:';
            break;
          case 'remote':
            emoji = ':house_with_garden:';
            break;
          case 'outside':
            emoji = ':car:';
            break;
          case 'remoteroom':
            emoji = ':desktop_computer:';
            break;
        }

        console.log('Selected action:', selectedAction);
        console.log('Assigned emoji:', emoji);
        console.log('User object:', JSON.stringify(user, null, 2));

        await updateUserStatus(user.id, selectedAction, emoji);

        const payload = JSON.parse(req.body.payload); // Slackのpayloadを解析
        let userName;
        getUserName(user.id).then((name) => {
          userName = name;
        });

        await botClient.chat.postMessage({
          channel: payload.channel.id,
          thread_ts: payload.message.ts,
          text: `${userName}さんが${selectedAction}を選択しました！`,
        });

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
async function updateUserStatus(
  userId: string,
  statusText: string,
  emoji: string
) {
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

async function getUserName(userId: string): Promise<string> {
  try {
    const response = await slackClient.users.info({ user: userId });

    if (response.ok && response.user) {
      const profile = response.user.profile as {
        real_name?: string;
        display_name?: string;
      };

      // display_name を優先し、存在しない場合は real_name を返す
      return profile.display_name || profile.real_name || 'Unknown User';
    } else {
      console.error('Failed to fetch user info:', response.error);
      return 'Unknown User';
    }
  } catch (error) {
    console.error('Error fetching user name:', error);
    return 'Unknown User';
  }
}
