import { LegalDoc } from './types';

export const enLegal: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    title: 'Terms of Use',
    updated: '30 October 2026',
    sections: [
      {
        heading: 'The service',
        body: 'This site is an independent, unofficial table for the traditional Albanian card game commonly called Murlan (also known as Pass). The rules of that folk game are a public tradition. They are not owned by this site or by any other app. There is no entry fee, no deposits, no cash-out, and no real-world prizes. It is not gambling.',
      },
      {
        heading: 'Not those other apps',
        body: 'This project is not Murlan Cards, Murlan Pro, MURLAN by TRIV.AL, murlan.app, or any other commercial Murlan product. It is not affiliated with, endorsed by, or a substitute for those apps or their publishers. We do not use their logos, card art, code, or store listings. If you downloaded a different Murlan app from the App Store or Google Play, that is a separate product.',
      },
      {
        heading: 'Who may use it',
        body: 'You must be at least 13 years old. If you are under 18, a parent or guardian should review these terms with you. Do not use the app if you cannot agree to them.',
      },
      {
        heading: 'Your account and name',
        body: 'Play under a made-up username. Do not use your real name, address, phone number, school, or other personal details as a username or in chat. You are responsible for what you type, say, and upload on your device.',
      },
      {
        heading: 'Chat, voice, and photos',
        body: 'Table chat, voice, and a profile photo are optional. Other people at your table can hear and see what you send. Do not share illegal, hateful, sexual involving minors, harassing, or infringing content. We may empty a table, mute a seat, delete chat, or end a game if someone breaks this. Voice is sent live to the table and is not kept as a recording. Chat is kept only while that table is live and is deleted when the game ends.',
      },
      {
        heading: 'Fair play',
        body: 'Do not cheat, attack the service, impersonate others, scrape accounts, or try to read hidden cards. The server decides the cards, scores, and whether a play is allowed. Game outcomes, disconnects, and admin actions (including ending a table) are final for the software. Player-to-player disputes are yours to resolve.',
      },
      {
        heading: 'As-is service',
        body: 'The app is provided as-is, without warranties of any kind, including fitness for a particular purpose, uninterrupted uptime, or error-free play. Hosting, your network, and your browser can fail. We may change, pause, or stop the service at any time.',
      },
      {
        heading: 'Limitation of liability',
        body: 'To the maximum extent allowed by law, the operator of Murlan is not liable for lost games, lost data, insults in chat, voice, missed connections, device issues, or indirect, incidental, or consequential damages. You use a free entertainment app. If a court finds this limit unenforceable, liability is limited to the amount you paid us for the app in the last 12 months, which is zero.',
      },
      {
        heading: 'Your responsibility',
        body: 'You agree to defend and hold the operator harmless from claims that arise from your content, your misuse of the app, or your breach of these terms, except where the law does not allow that.',
      },
      {
        heading: 'Changes',
        body: 'We may update these terms. The in-app version is the current one. If the version number changes, you will be asked to accept again before playing.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: '30 October 2026',
    sections: [
      {
        heading: 'What this app stores',
        body: 'To run a table we store a guest account: a username, optional avatar, win/loss counts, friends, and a one-way hash of a secret that stays on your device. We do not collect your legal name, payment cards, or government ID. Do not put those into chat or your username.',
      },
      {
        heading: 'On your device',
        body: 'Your device keeps the identity secret, session token, settings, language, and any profile photo you choose. Photos are not uploaded to the game server.',
      },
      {
        heading: 'During a game',
        body: 'Seated players can see usernames, public cards, scores, and chat. Voice is streamed to other seats at that table while you unmute. Voice is not archived. Chat is stored for that table only and is deleted when the game ends.',
      },
      {
        heading: 'Hosting',
        body: 'The game server and database are run by our hosting providers so the app can function. They process that data only to operate the service. We do not sell your data and we do not use it for advertising profiles.',
      },
      {
        heading: 'Children',
        body: 'The app is not directed at children under 13. We do not knowingly keep accounts for children under 13. If you believe we have, stop using the app and contact the operator so the guest account can be removed.',
      },
      {
        heading: 'How long',
        body: 'Guest stats and friends stay while the account exists. Chat ends with the table. You can stop using the app at any time. Clearing the site data on your device drops the local secret; the server-side guest row may remain until it is pruned as unused.',
      },
      {
        heading: 'Requests',
        body: 'This is a small free game. For access or deletion questions, contact the operator of this Murlan site. We will do what the law requires and what the running system reasonably allows.',
      },
    ],
  },
};
