import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';

const userToken = process.env.SLACK_TOKEN;
const userClient = new WebClient(userToken);
const botToken = process.env.BOT_TOKEN;
const botClient = new WebClient(botToken);

export const config = {
  api: {
    bodyParser: false, // デフォルトのbodyParserを無効にしてカスタムで処理
  },
};

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
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      const parsedBody = JSON.parse(buffer.toString());

      const { actions, user, channel, message } = parsedBody;

      if (actions && actions.length > 0) {
        console.log('actions:' + JSON.stringify(actions, null, 2));

        const selectedAction = actions[0].value || '退勤';

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

        // ステータス更新
        await updateUserStatus(user.id, selectedAction, emoji);

        // ユーザの表示名を取得してスレッドにポスト
        const userName = await getUserName(user.id);
        await botClient.chat.postMessage({
          channel: channel.id,
          thread_ts: message.ts,
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
    // statusセットの場合、時刻も設定
    if (statusText && emoji) {
      await userClient.users.profile.set({
        user: userId,
        profile: {
          status_text: statusText,
          status_emoji: emoji,
        },
      });

      // 20時までの時間を計算して、タイマーでリセット
      setTimeout(async () => {
        await userClient.users.profile.set({
          user: userId,
          profile: {
            status_text: '',
            status_emoji: '',
          },
        });
      }, getRemainingTimeUntil20h()); // 20時までの時間を計算してセット
    } else {
      await userClient.users.profile.set({
        user: userId,
        profile: {
          status_text: '',
          status_emoji: '',
        },
      });
    }
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

// 20時までの残り時間をミリ秒で計算
function getRemainingTimeUntil20h(): number {
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(20, 0, 0, 0); // 20時00分

  if (now > targetTime) {
    // 今日の20時を過ぎている場合は、明日の20時までの時間を計算
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime.getTime() - now.getTime();
}
