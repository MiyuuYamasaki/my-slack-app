import { WebClient, ModalView } from '@slack/web-api';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { use } from 'react';
import { Result } from 'postcss';
import { channel } from 'diagnostics_channel';

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
      console.log(actions);

      console.log('parsedBody:', JSON.stringify(parsedBody, null, 2));

      // actionと絵文字の紐づけ
      type ActionEmojiMap = {
        [key: string]: string;
      };
      const actionEmojis: ActionEmojiMap = {
        本社勤務: ':office:',
        在宅勤務: ':house_with_garden:',
        外出中: ':car:',
        リモート室: ':desktop_computer:',
        退勤: '', // 空文字列
      };

      if (actions && actions.length > 0) {
        const tasks = [];

        let selectedAction = actions[0].value;
        console.log('selectedAction:' + selectedAction);

        // console.log(JSON.stringify(message, null, 2));

        if (selectedAction === 'OA認証') {
          // モーダルウィンドウを開く
          await botClient.views.open({
            trigger_id: trigger_id,
            view: createUserModal(user.name, channel.id),
          });
        } else if (selectedAction === 'NONE') {
          console.log('OK! Do not forever.');
          const result = await insertToken(user.name, 'Not required');
          const responseText = result
            ? 'OK! 今後は表示しません。\n必要になった場合は、管理者へお問い合わせください。'
            : '既にOA認証済みではないですか？\n認証の覚えがない場合、管理者へお問い合わせください。';
          await botClient.chat.postEphemeral({
            channel: channel.id,
            user: user.id,
            text: responseText,
          });
        } else if (Object.keys(actionEmojis).includes(selectedAction)) {
          // ユーザトークンを取得
          const userToken =
            (await getTokenByUserId(user.name)) || process.env.SLACK_TOKEN;
          console.log('userToken:' + userToken);

          let isUser: number;
          if (userToken === 'Not required') {
            isUser = 0; // OA認証表示なし && ステータス変更なし
          } else if (userToken != process.env.SLACK_TOKEN) {
            isUser = 1; // ステータス変更あり
          } else {
            isUser = 2; // OA認証表示あり
          }
          console.log('isUser:' + isUser);

          const userClient = new WebClient(
            userToken != 'Not required' ? userToken : process.env.SLACK_TOKEN
          );

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

          if (isUser === 1) {
            // Statusを更新
            await updateUserStatus(
              userClient,
              user.id,
              selectedAction === '退勤' ? '' : selectedAction,
              actionEmojis[selectedAction],
              getTodayAt8PMJST()
            );
          } else if (isUser === 2) {
            // ユーザがトークンを取得していない場合ステータス変更なし
            let responseText = `OA認証されていないため、ステータス変更ができません。\nOA認証を行いますか？`;
            botClient.chat.postEphemeral({
              channel: channel.id,
              user: user.id,
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
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '今後表示しない',
                        emoji: true,
                      },
                      action_id: 'button_none',
                      value: 'NONE',
                    },
                  ],
                },
              ],
            });
          }

          tasks.push(
            (async () => {
              // Recordを更新
              await upsertRecord(
                user.name,
                await getFormattedDate(),
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

          console.log(members);
          console.log('start createModal');
          // モーダルを表示
          await botClient.views.open({
            trigger_id: trigger_id,
            view: await createModal(members, channel.id, prisma),
          });
        }

        res.status(200).send('Status updated');
      } else {
        try {
          // const action = parsedBody.view.
          // モーダルから入力された値を取得
          const token =
            parsedBody.view.state.values.token_block.token_input.value;
          console.log('token:' + token + ' user:' + user.name);

          // private_metadata を取得
          const privateMetadata = JSON.parse(parsedBody.view.private_metadata);
          const channelId = privateMetadata.channel_id; // channel_id を取り出す
          console.log('channelId:' + channelId);

          const result = await insertToken(user.name, token);

          // ユーザがトークンを取得していない場合ステータス変更なし
          let responseText = result
            ? 'OA認証が成功しました😊'
            : '問題が発生しました。\n管理者へお問い合わせください。';

          await botClient.chat.postEphemeral({
            channel: channelId,
            user: user.id,
            text: responseText,
          });

          const existingRecord = await prisma.record.findFirst({
            where: {
              user_id: user.name,
              ymd: await getFormattedDate(),
              channel_id: channelId,
            },
          });

          if (existingRecord) {
            const selectedAction = existingRecord.selected_status;
            const userClient = new WebClient(token);
            // Statusを更新
            await updateUserStatus(
              userClient,
              user.id,
              selectedAction === '退勤' ? '' : selectedAction,
              actionEmojis[selectedAction],
              getTodayAt8PMJST()
            );
          } else {
            console.log('Statsu chnage failed');
          }

          res.status(200).send({});
        } catch (error) {
          console.error(error);

          // モーダルを閉じずにエラーを返したい場合の例
          res.status(400).send({
            response_action: 'errors',
            errors: {
              token_block: 'トークンの保存に失敗しました。再度試してください。',
            },
          });
        }
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
  const userRecord = await prisma.users.findFirst({
    where: {
      slack_user_id: userId,
    },
  });

  console.log('userRecord:', JSON.stringify(userRecord, null, 2));

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

    console.log('existingRecord:', JSON.stringify(existingRecord, null, 2));

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
async function insertToken(
  slackUserId: string,
  Token: string
): Promise<boolean> {
  try {
    await prisma.users.create({
      data: {
        slack_user_id: slackUserId,
        token: Token,
      },
    });
    return true; // 挿入成功時は true を返す
  } catch (error) {
    console.error('Error processing user:', error);
    return false; // 挿入失敗時は false を返す
  }
}

async function getFormattedDate() {
  const ymd = new Date();
  // 日本時間に合わせる（UTC + 9 時間）
  ymd.setHours(ymd.getHours() + 9);

  return ymd.toISOString().split('T')[0].toString() || '';
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
const createModal = async (members: string[], channel: string, prisma: any) => {
  // ステータス情報を取得
  const existingRecord = await prisma.record.findFirst({
    where: {
      ymd: await getFormattedDate(),
      channel_id: channel,
    },
  });

  // メンバーを分類するためのマップを用意
  const statusMap: { [key: string]: string[] } = {
    本社勤務: [],
    在宅勤務: [],
    外出中: [],
    リモート室: [],
    休暇: [],
  };

  // メンバーをステータスごとに分類
  members.forEach((member) => {
    const status = existingRecord?.[member] || '休暇'; // ステータスが無い場合は "休暇"
    if (!statusMap[status]) {
      statusMap[status] = [];
    }
    statusMap[status].push(member);
  });

  // 各ステータスのリストをモーダルのテキストとして生成
  const statusSections = Object.keys(statusMap).map((status) => ({
    type: 'section',
    text: {
      type: 'mrkdwn' as const,
      text: `*${status}*\n${
        statusMap[status].map((member) => `<@${member}>`).join('\n') || 'なし'
      }`,
    },
  }));

  // モーダルデータ
  return {
    type: 'modal' as const,
    title: {
      type: 'plain_text' as const,
      text: 'チャンネルメンバー',
    },
    close: {
      type: 'plain_text' as const,
      text: '閉じる',
    },
    blocks: statusSections,
  };
};

// OA認証用のモーダルを作成する関数
const createUserModal = (user_id: string, channel_id: string): ModalView => {
  // ユーザーの場合のモーダル
  return {
    type: 'modal',
    callback_id: 'modal_oa_auth',
    private_metadata: JSON.stringify({
      channel_id: channel_id,
    }),
    title: {
      type: 'plain_text',
      text: 'OA認証',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `①URLをクリック https://api.slack.com/apps/A085S81KVAS/oauth? \n②OAuth Tokensの「install to SBS-OCC」をClickして認証\n③User OAuth Tokenをコピーして貼り付け！`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*User Id*: ${user_id}`,
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
          text: '*User OAuth Token*',
        },
      },
    ],
    submit: {
      type: 'plain_text',
      text: '確定',
    },
  };
};
