// Extends app.json. EXPO_BASE_URL is set by the GitHub Pages workflow (e.g. "/Murlan")
// because a project site is served from https://<user>.github.io/<repo>/.
module.exports = ({ config }) => ({
  ...config,
  web: {
    ...config.web,
    name: 'Murlan Table',
    shortName: 'Murlan Table',
    description: 'Independent web table for the traditional Albanian card game. Not affiliated with other Murlan apps.',
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
