// Extends app.json. EXPO_BASE_URL is set by the GitHub Pages workflow (e.g. "/Murlan")
// because a project site is served from https://<user>.github.io/<repo>/.
module.exports = ({ config }) => ({
  ...config,
  web: {
    ...config.web,
    name: 'Murlan',
    shortName: 'Murlan',
    description: 'Albanian Murlan card game. Play 2 vs 2 with friends.',
    themeColor: '#071016',
    backgroundColor: '#071016',
    orientation: 'landscape',
    output: 'single',
  },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
