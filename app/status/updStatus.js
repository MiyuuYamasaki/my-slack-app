const express = require('express');
const { WebClient } = require('@slack/web-api');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const port = 3000;
const web = new WebClient(process.env.SLACK_TOKEN);

// Slackのリクエスト署名検証用
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

app.use(bodyParser.urlencoded({ extended: true }));

// インタラクションの受け取りエンドポイント
app.post('/slack/actions', async (req, res) => {
  // リクエストの検証
  const sig = req.headers['x-slack-signature'];
  const ts = req.headers['x-slack-request-timestamp'];
  const body = JSON.stringify(req.body);
  const sigBasestring = `v0:${ts}:${body}`;
  const mySignature = `v0=${crypto
    .createHmac('sha256', slackSigningSecret)
    .update(sigBasestring)
    .digest('hex')}`;

  if (sig !== mySignature) {
    return res.status(400).send('Request verification failed');
  }

  // ボタンのインタラクションを処理
  const { payload } = req.body;
  const action = JSON.parse(payload);

  const userId = action.user.id;
  const selectedStatus = action.actions[0].value;

  try {
    // ユーザーのステータスを更新
    await web.users.profile.set({
      user: userId,
      profile: {
        status_text: selectedStatus === 'remote' ? '在宅' : '出社',
        status_emoji: selectedStatus === 'remote' ? ':house:' : ':office:',
      },
    });
    res.status(200).send('');
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).send('Error updating user status');
  }
});

// サーバーの起動
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
