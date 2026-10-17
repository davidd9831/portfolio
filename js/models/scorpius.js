// Scorpius, FTC DECODE 2025–26 (Team 6832). Two models: the full robot and the intake on its own.
export default {
  title: 'Scorpius',
  models: [
    { label: 'Full robot', url: new URL('../../assets/models/scorpius.glb', import.meta.url).href, orbit: { theta: 35, phi: 70 } },
    { label: 'Intake', url: new URL('../../assets/models/scorpius-intake.glb', import.meta.url).href, orbit: { theta: 35, phi: 66 } },
  ],
  exposure: 0.92,
  orbit: { theta: 35, phi: 70 },
  views: [
    { label: '3/4 view', theta: 35, phi: 70 },
    { label: 'Side view', theta: 90, phi: 88 },
    { label: 'Opposite side', theta: -90, phi: 88 },
    { label: 'Top view', theta: 0, phi: 0.01 },
  ],
};
