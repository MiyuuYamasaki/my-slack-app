import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import { NextApiRequest, NextApiResponse } from 'next';

// 環境変数
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_TOKEN = process.env.SLACK_TOKEN || '';

const web = new WebClient(SLACK_TOKEN);

console.log('SLACK_TOKEN:' + SLACK_TOKEN);

const verifySlackRequest = (req: NextApiRequest): boolean => {
  const slackSignature = req.headers['x-slack-signature'] as string;
  const slackTimestamp = req.headers['x-slack-request-timestamp'] as string;

  const baseString = `v0:${slackTimestamp}:${JSON.stringify(req.body)}`;
  const hash = crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex');

  const calculatedSignature = `v0=${hash}`;
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(slackSignature)
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  if (!verifySlackRequest(req)) {
    res.status(400).send('Verification failed');
    return;
  }

  try {
    const payload = JSON.parse(req.body.payload); // Slackのペイロードを取得
    const userId = payload.user.id; // ユーザーID
    const action = payload.actions[0].value; // ボタンで送信された値

    await web.chat.postMessage({
      channel: payload.channel.id,
      thread_ts: payload.message.ts,
      text: `${userId}さん、おはようございます。`,
    });

    console.log('userId:' + userId);

    // Slackのステータスを更新
    await web.users.profile.set({
      user: userId,
      profile: { status_text: action, status_emoji: ':white_check_mark:' },
    });

    res.status(200).send('Status updated');
  } catch (error) {
    console.error('Error processing Slack interaction:', error);
    res.status(500).send('Internal Server Error');
  }
};

export default handler;
