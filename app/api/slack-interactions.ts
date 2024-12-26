import { WebClient, ModalView } from '@slack/web-api';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Slackのトークンを環境変数から取得

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

      if (actions && actions.length > 0) {
        const tasks = [];

        let selectedAction = actions[0].value;
        console.log('selectedAction:' + selectedAction);

        if (selectedAction === 'OA認証') {
          const modalView: ModalView = {
            type: 'modal', // ここで "modal" を明示的に指定
            title: {
              type: 'plain_text',
              text: 'OA認証',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `①URLをCクリック（https://api.slack.com/apps/A085S81KVAS/oauth?）\n②OAuth Tokensの「install to SBS-OCC」をClickして認証\n③User OAuth Tokenをコピーして貼り付け！`,
                },
              },
              {
                type: 'input',
                block_id: 'token_block',
                element: {
                  type: 'plain_text_input',
                  action_id: 'token_input',
                  placeholder: {
                    type: 'plain_text',
                    text: 'User OAuth Tokenを入力',
                  },
                },
                label: {
                  type: 'plain_text',
                  text: 'User OAuth Token',
                },
              },
            ],
            submit: {
              type: 'plain_text',
              text: '確定',
            },
          };

          // モーダルウィンドウを開く
          await botClient.views.open({
            trigger_id: trigger_id,
            view: modalView,
          });
        } else if (selectedAction != undefined) {
          // ユーザトークンを取得
          const defaultUserToken = process.env.SLACK_TOKEN;
          const userToken =
            (await getTokenByUserId(user.id)) || process.env.SLACK_TOKEN;
          const userClient = new WebClient(userToken);
          let isStatus = defaultUserToken === userToken;

          // ユーザがトークンを取得していない場合ステータス変更なし
          if (isStatus) {
            let responseText = `@${user.name}\nOA認証されていないため、ステータス変更ができません。認証しますか？`;
            botClient.chat.postMessage({
              channel: channel.id,
              text: responseText,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: responseText,
                  },
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '認証',
                        emoji: true,
                      },
                      action_id: 'button_add',
                      style: 'primary',
                      value: 'OA認証',
                    },
                  ],
                },
              ],
            });
          }

          tasks.push(
            (async () => {
              const userName = await getUserName(userClient, user.id);
              return botClient.chat.postMessage({
                channel: channel.id,
                thread_ts: message.ts,
                text: `${userName}さんが${selectedAction}を選択しました！`,
              });
            })()
          );

          // TOKENがない場合ステータス変更なし。
          if (!isStatus) {
            // Statusに反映する絵文字をセット
            let emoji = '';
            let timestamp = 0;

            tasks.push(
              (async () => {
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

                // 20:00までのタイムスタンプを取得
                timestamp = getTodayAt8PMJST();

                // Statusを更新
                await updateUserStatus(
                  userClient,
                  user.id,
                  selectedAction,
                  emoji,
                  timestamp
                );
              })()
            );
          }

          tasks.push(
            (async () => {
              const ymd = new Date();
              // 日本時間に合わせる（UTC + 9 時間）
              ymd.setHours(ymd.getHours() + 9);

              // 日付部分だけを取得（"YYYY-MM-DD"）
              const formattedDate = ymd.toISOString().split('T')[0];

              console.log(formattedDate); // 例: "2024-12-26"

              // Recordを更新
              await upsertRecord(
                user.id,
                formattedDate,
                channel.id,
                selectedAction
              );
            })()
          );

          try {
            await Promise.all(tasks);
          } catch (error) {
            console.error('task実行時にエラーが発生しました:' + error);
          }
        } else {
          // 一覧を表示
          // チャンネルメンバーを取得
          const membersResponse = await botClient.conversations.members({
            channel: channel.id,
          });
          const members = membersResponse.members || [];

          // メンバー情報を取得してBotを除外
          const filteredMembers: string[] = [];
          for (const memberId of members) {
            const userInfo = await botClient.users.info({ user: memberId });
            if (!userInfo.user?.is_bot && userInfo.user?.id !== 'USLACKBOT') {
              filteredMembers.push(memberId);
            }
          }

          // モーダルを表示
          await botClient.views.open({
            trigger_id: trigger_id,
            view: createModal(filteredMembers),
          });
        }
        res.status(200).send('Status updated');
      } else {
        res.status(400).send('No actions found');
      }
    } catch (error) {
      console.error('Error processing Slack interaction:', error);
      res.status(500).json({
        message: 'Internal Server Error' + error,
      });
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
}

// ユーザートークン取得
async function getTokenByUserId(userId: string) {
  const userRecord = await prisma.user.findFirst({
    where: {
      slack_user_id: userId,
    },
  });

  return userRecord ? userRecord.token : process.env.SLACK_TOKEN;
}

// ユーザーのステータスを更新する関数
async function updateUserStatus(
  userClient: WebClient,
  userId: string,
  statusText: string,
  emoji: string,
  timestamp: number
) {
  try {
    const statusExpiration = emoji ? '' : 0; // emojiが空でなければtimestamp、そうでなければ0を設定

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

// record操作
async function upsertRecord(
  userId: string,
  ymd: string,
  channelId: string,
  selectedStatus: string
) {
  try {
    // 既存のレコードがあるか確認
    const existingRecord = await prisma.record.findFirst({
      where: {
        user_id: userId,
        ymd: ymd,
        channel_id: channelId,
      },
    });

    console.log('existingRecord:' + existingRecord);

    if (!existingRecord) {
      // レコードが存在しない場合、作成
      await prisma.record.create({
        data: {
          user_id: userId,
          ymd: ymd,
          selected_status: selectedStatus,
          channel_id: channelId,
        },
      });
    } else if (existingRecord.selected_status !== selectedStatus) {
      // レコードが存在し、selected_statusが異なる場合、更新
      await prisma.record.update({
        where: { id: existingRecord.id },
        data: {
          selected_status: selectedStatus,
        },
      });
    }
  } catch (error) {
    console.error('Error processing record:', error);
  }
}

// user操作
async function upsertUser(slackUserId: string, Token: string) {
  try {
    // 既存のレコードがあるか確認
    const existingUserRecord = await prisma.user.findFirst({
      where: {
        slack_user_id: slackUserId,
      },
    });

    console.log('existingUserRecord:' + existingUserRecord);

    if (!existingUserRecord) {
      return false;
    }
  } catch (error) {
    console.error('Error processing user:', error);
  }
}

// ユーザの表示名を取得する関数
export async function getUserName(
  userClient: WebClient,
  userId: string
): Promise<string> {
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
