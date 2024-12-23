import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import bodyParser from 'body-parser';

// Slackのトークンを環境変数から取得
const slackToken = process.env.SLACK_TOKEN;
const slackClient = new WebClient(slackToken);

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
          case '本社勤務':
            emoji = '🏢';
            break;
          case '在宅勤務':
            emoji = '🏠';
            break;
          case '外出中':
            emoji = '🚗';
            break;
          case 'リモート室':
            emoji = '🖥️';
            break;
        }
        await updateUserStatus(user.id, selectedAction, emoji);

        const payload = JSON.parse(req.body.payload); // Slackのpayloadを解析

        await slackClient.chat.postMessage({
          channel: payload.channel.id,
          thread_ts: payload.message.ts,
          text: `${user.id}さんが${selectedAction}を選択しました！`,
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
