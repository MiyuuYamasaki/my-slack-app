import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import bodyParser from 'body-parser';

// Slackのトークンを環境変数から取得
const userToken = process.env.SLACK_TOKEN;
const userClient = new WebClient(userToken);
const botToken = process.env.BOT_TOKEN;
const botClient = new WebClient(botToken);

export const config = {
  api: {
    bodyParser: false, // デフォルトのbodyParserを無効にしてカスタムで処理
  },
};

// Slackインタラクションのペイロードの型定義
type SlackInteractionPayload = {
  actions: { name: string; value: string }[];
  user: { id: string; username: string };
  channel: { id: string };
  message: { ts: string };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const parsedBody = await new Promise<SlackInteractionPayload>(
        (resolve, reject) => {
          bodyParser.urlencoded({ extended: true })(req, res, (err) => {
            if (err) reject(err);
            resolve(JSON.parse(req.body.payload));
          });
        }
      );

      const { actions, user, channel, message } = parsedBody;

      if (actions && actions.length > 0) {
        console.log('actions:' + JSON.stringify(actions, null, 2));

        let selectedAction = actions[0].value;

        // ユーザの表示名を取得しスレッドにポスト
        const userName = await getUserName(user.id);
        // Value設定する
        await botClient.chat.postMessage({
          channel: channel.id,
          thread_ts: message.ts,
          text: `${userName}さんが${selectedAction}を選択しました！`,
        });

        console.log('User ID:', user.id);
        const userInfo = await userClient.users.info({ user: 'U07HCB8DDHD' });
        console.log(userInfo);

        // Stasus用の絵文字を設定
        let emoji = '';
        switch (selectedAction) {
          case '本社勤務':
            emoji = ':office:';
            break;
          case '在宅勤務':
            emoji = ':house_with_garden:';
            break;
          case '外出中':
            emoji = ':car:';
            break;
          case 'リモート室':
            emoji = ':desktop_computer:';
            break;
          case '退勤':
            selectedAction = '';
            break;
        }
        console.log('selectedAction:' + selectedAction);
        await updateUserStatus('U07HCB8DDHD', selectedAction, emoji); // status更新

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
    await userClient.users.profile.set({
      user: userId,
      profile: {
        status_text: statusText,
        status_emoji: emoji,
        status_expiration: emoji ? 1735000200 : '',
      },
    });
    console.log('Status updated:', userId);
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

// ユーザの表示名を取得する関数
export async function getUserName(userId: string): Promise<string> {
  try {
    const result = await userClient.users.info({ user: userId });

    if (result.user) {
      const profile = result.user.profile as {
        real_name?: string;
        display_name?: string;
      };

      return profile.display_name || profile.real_name || 'Unknown User';
    }

    return 'Unknown User';
  } catch (error) {
    console.error('Error fetching user name:', error);
    throw new Error('Failed to fetch user name');
  }
}
