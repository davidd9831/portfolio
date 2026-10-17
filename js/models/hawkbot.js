// HawkBot V2, FTC Into the Deep 2024–25 (Team 3734). Untextured CAD export, Z up.
export default {
  title: 'HawkBot V2',
  models: [{ label: 'Robot', url: new URL('../../assets/models/hawkbot.glb', import.meta.url).href }],
  up: 'z',
  exposure: 0.78,
  orbit: { theta: 35, phi: 70 },
  views: [
    { label: '3/4 view', theta: 35, phi: 70 },
    { label: 'Side view', theta: 90, phi: 88 },
    { label: 'Opposite side', theta: -90, phi: 88 },
    { label: 'Top view', theta: 0, phi: 0.01 },
  ],
};
