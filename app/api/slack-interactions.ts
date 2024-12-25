import { WebClient } from '@slack/web-api';
import { NextApiRequest, NextApiResponse } from 'next';

// Slackのトークンを環境変数から取得
const userToken = process.env.SLACK_TOKEN;
const userClient = new WebClient(userToken);
const botToken = process.env.BOT_TOKEN;
const botClient = new WebClient(botToken);

export const config = {
  api: {
    bodyParser: true, // デフォルトの body parser を使う
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const parsedBody = JSON.parse(req.body.payload);
      const { actions, user, channel, message, trigger_id } = parsedBody;
      console.log('triggerId:', trigger_id);

      if (actions && actions.length > 0) {
        console.log('actions:', JSON.stringify(actions, null, 2));

        let selectedAction = actions[0].value;

        const userName = await getUserName(user.id);
        await botClient.chat.postMessage({
          channel: channel.id,
          thread_ts: message.ts,
          text: `${userName}さんが${selectedAction}を選択しました！`,
        });

        if (selectedAction) {
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
          const timestamp = getTodayAt8PMJST();
          await updateUserStatus(user.id, selectedAction, emoji, timestamp);
        } else {
          const membersResponse = await botClient.conversations.members({
            channel: channel.id,
          });
          const members = membersResponse.members || [];
          await botClient.views.open({
            trigger_id,
            view: createModal(members),
          });
        }

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

  // JSTの20時をUTCの11時にするため、9時間戻す
  now.setMinutes(now.getMinutes() - 9 * 60); // 9時間分を引く
  return Math.floor(now.getTime() / 1000); // 秒単位に変換して返す
};

// モーダルを作成する関数
const createModal = (members: string[]) => {
  return {
    type: 'modal' as const, // 'modal' を明示的にリテラル型として指定
    title: {
      type: 'plain_text' as const, // "plain_text"をリテラル型として指定
      text: 'チャンネルメンバー',
    },
    close: {
      type: 'plain_text' as const,
      text: '閉じる',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: members
            .map((member, index) => `${index + 1}. <@${member}>`)
            .join('\n'),
        },
      },
    ],
  };
};
