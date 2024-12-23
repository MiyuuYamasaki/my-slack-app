/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    SLACK_TOKEN: process.env.SLACK_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
  },
};
