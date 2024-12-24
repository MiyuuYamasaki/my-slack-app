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
        const userInfo = await userClient.users.info({ user: user.id });
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
        const timestamp = getTodayAt8PMJST();
        console.log(timestamp);

        await updateUserStatus(user.id, selectedAction, emoji, timestamp); // status更新

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
  emoji: string,
  timestamp: number
) {
  try {
    const statusExpiration = emoji ? 1735038000 : 0; // emojiが空でなければtimestamp、そうでなければ0を設定

    await userClient.users.profile.set({
      user: userId,
      profile: {
        status_text: statusText,
        status_emoji: emoji,
        status_expiration: statusExpiration,
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

const getTodayAt8PMJST = (): number => {
  const now = new Date();
  // JST（UTC+9）の20時に設定
  now.setHours(20, 0, 0, 0);
  // JSTに合わせるために、UTCから9時間進める
  const jstOffset = 9 * 60; // JSTはUTCより9時間進んでいる
  now.setMinutes(now.getMinutes() + jstOffset);
  return now.getTime(); // タイムスタンプを返す
};
