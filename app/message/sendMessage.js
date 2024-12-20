import { WebClient } from '@slack/web-api';

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const CHANNEL_ID = 'C083QUBKU9L'; // 送信先のチャンネルID

// 日付のフォーマットを変更
function getFormattedDate() {
  const now = new Date();

  // 日本時間に合わせる（UTC + 9 時間）
  now.setHours(now.getHours() + 9);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月は0から始まるので+1
  const day = String(now.getDate()).padStart(2, '0');

  // 曜日を取得（日本語）
  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = daysOfWeek[now.getDay()];

  return `${year}/${month}/${day}(${dayOfWeek})`; // 例: 2024/12/05(木)
}

// Slack Web APIクライアントを初期化
const client = new WebClient(SLACK_TOKEN);

async function sendSlackMessage(channelId) {
  try {
    const formattedDate = getFormattedDate();
    const result = await client.chat.postMessage({
      channel: channelId,
      text: `ステータスを選択してください！${formattedDate}`, // 必須フィールド
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `ステータスを選択してください！${formattedDate}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🏢 本社',
                emoji: true,
              },
              action_id: 'button_office',
              value: 'office',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🏠 在宅',
                emoji: true,
              },
              action_id: 'button_remote',
              value: 'remote',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🚗 外出',
                emoji: true,
              },
              action_id: 'button_outside',
              value: 'outside',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🖥️ リモート室',
                emoji: true,
              },
              action_id: 'button_remoteroom',
              value: 'remoteroom',
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: `📋 一覧`,
                emoji: true,
              },
              action_id: 'button_list',
              style: 'primary',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: `👋 退勤`,
                emoji: true,
              },
              action_id: 'button_goHome',
              style: 'danger',
            },
          ],
        },
      ],
    });
    console.log('Message sent: ', result.ts);
  } catch (error) {
    console.error('Error sending message: ', error);
  }
}

sendSlackMessage(CHANNEL_ID); // ボタン付きメッセージ送信
