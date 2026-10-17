// Brake pedal assembly (Texas A&M FSAE EV chassis design challenge)
// Model: assets/models/brake-pedal.glb, converted from "Brake Assembly v2.step" (Fusion 360, Oct 16).
// Coordinates below are in the CAD frame of the GLB (millimetres, Z up, X toward the master cylinders).
//
// Kinematics, worked out from the CAD geometry:
//  * The pedal pivots about the M8 pivot bolt at x = -124.45, z = -30.0.
//  * The balance bar's 1 in spherical bearing rides in a 1 in wide slot in the pedal. The pushrods keep the
//    bearing on the master-cylinder axis, so it can only slide in X. Over the full length of the slot that
//    gives 27.9 mm (1.1 in) of master cylinder travel, which matches the design write-up.
//  * Rest = bearing at the bottom of the slot (pistons fully returned). The exported model sits 8.69° past rest.
//  * Hard stop = first contact between the pedal arm and the stop plate: 30.3° of travel.
//  * Lock-up (15°) is from the write-up; BOTS trip (21°) is read from the four-position figure.
//  * The BOTS toggle lever is pushed by the pedal arm; its angle was found by collision checks against the arm.

const URL_MODEL = new URL('../../assets/models/brake-pedal.glb', import.meta.url).href;

const PIVOT = { x: -0.12445, z: -0.0300 };              // metres
const SLOT_C = [-0.09895, 0.00615];                      // slot centreline point (x, z) in the model pose
const SLOT_U = (() => { const v = [17.1, 42.4]; const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; })();
const BAR_Z = -0.00029;                                  // bearing centre height (on the master cylinder axis)
const REST = -8.6935;                                    // degrees from the exported pose back to rest
const MC_STROKE = 0.02794;                               // 1.1 in
const LEVER_PIN = { x: -0.0518498, z: 0.00170788 };
// toggle lever angle (deg) vs pedal angle in the exported pose (deg)
const LEVER = [[8.0, 0], [8.5, 0.75], [9.0, 2.5], [9.5, 4.25], [10.0, 5.75], [10.5, 7.5], [11.0, 9.25], [11.5, 10.75],
  [12.0, 12.5], [12.5, 14.25], [13.0, 15.75], [13.5, 17.5], [14.0, 19.25], [14.5, 21.0], [15.0, 22.75], [15.5, 24.25],
  [16.0, 26.0], [16.5, 27.75], [17.0, 29.5], [17.5, 31.25], [18.0, 33.0], [18.5, 34.75], [19.0, 36.75], [19.5, 38.75],
  [20.0, 40.75], [20.5, 42.5], [21.0, 44.5], [21.5, 46.5], [22.0, 50.5]];

const REST_ANGLE = 76.8;  // pedal angle at rest, from the write-up
const POSITIONS = [
  { n: 1, label: 'Rest', travel: 0 },
  { n: 2, label: 'Lock-up', travel: 15 },
  { n: 3, label: 'BOTS trip', travel: 21 },
  { n: 4, label: 'Hard stop', travel: 30.3 },
];

function rot2(v, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [c * v[0] + s * v[1], -s * v[0] + c * v[1]];
}
function barX(modelDeg) {
  const phi = modelDeg * Math.PI / 180;
  const r = rot2([SLOT_C[0] - PIVOT.x, SLOT_C[1] - PIVOT.z], phi);
  const c0 = [PIVOT.x + r[0], PIVOT.z + r[1]];
  const u = rot2(SLOT_U, phi);
  const t = (BAR_Z - c0[1]) / u[1];
  return c0[0] + t * u[0];
}
function leverAngle(modelDeg) {
  if (modelDeg <= LEVER[0][0]) return 0;
  for (let i = 1; i < LEVER.length; i++) {
    if (modelDeg <= LEVER[i][0]) {
      const [a, b] = LEVER[i - 1], [c, d] = LEVER[i];
      return b + (d - b) * (modelDeg - a) / (c - a);
    }
  }
  return LEVER[LEVER.length - 1][1];
}

const M4_SCREW = 'Broached Hexagon Socket Head Cap Screw ASME B18.3.1M - M4x0.7 x 40 Steel Grade 2 Plain:';
const M4_NUT = 'Nylon Insert Locknut ASME B18.16.6 - 4-40 NM Steel Grade 2H Plain:';
const PEDAL_NODES = ['Pedal Assembly:1', M4_SCREW + 1, M4_SCREW + 2, M4_SCREW + 3, M4_NUT + 1, M4_NUT + 2, M4_NUT + 3];
const BAR_NODES = ['72-250 .375 BALANCE BAR, 10-20-2014:1', 'Piston:2'];
const LEVER_NODES = ['TL11039:1', 'TL11552:1', 'TL10045:1'];
const FASTENERS = ['Hex Head Bolt', 'Nylon Insert Locknut', 'Broached Hexagon Socket Head Cap Screw', 'Hexagon Socket Head Cap Screw'];

// "M8x35" style sizes pulled out of the CAD library names for the selection card
function fastenerLabel(name) {
  const clean = String(name).replace(/:\d+$/, '');
  let size = '';
  let m;
  if ((m = clean.match(/\b(M\d+)\s*x\s*[\d.]+\s*x\s*(\d+)/))) size = `${m[1]} × ${m[2]} mm`;
  else if ((m = clean.match(/\b(M\d+)x(\d+)\b/))) size = `${m[1]} × ${m[2]} mm`;
  else if ((m = clean.match(/\b(\d+\/\d+-\d+)\b/))) size = `${m[1]}`;
  else if ((m = clean.match(/\s(\d{1,2}-\d{2})\s/))) size = `#${m[1]}`;
  let kind = 'Fastener';
  if (/Locknut/.test(clean)) kind = 'Nylon-insert lock nut';
  else if (/Hex Head Bolt/.test(clean)) kind = 'Hex head bolt';
  else if (/Socket Head Cap Screw/.test(clean)) kind = 'Socket head cap screw';
  return size ? `${kind}, ${size}` : kind;
}

let nodes = null;
const tmp = {};

export default {
  title: 'Brake Assembly v2',
  models: [{ label: 'Assembly', url: URL_MODEL }],
  up: 'z',
  unitScale: 0.001,
  exposure: 1.0,
  edges: true,
  edgeAngle: 32,
  // The switch maker's model includes a "DUMMY" body that duplicates the toggle lever.
  // It would stay upright while the real lever is pushed over, so it is hidden.
  hidden: ['DUMMY:1'],
  orbit: { theta: -128, phi: 66 },
  ambientScale: 0.62,
  ambientSpeed: 6,
  views: [
    { label: '3/4 view', theta: -128, phi: 66 },
    { label: 'Side (like the motion figure)', theta: 0, phi: 90 },
    { label: 'Driver’s view', theta: -90, phi: 74 },
    { label: 'Top', theta: 0, phi: 0.01 },
  ],

  parts: [
    { id: 'arm', n: 1, name: 'Pedal arm', spec: 'Machined 4130 steel', nodes: ['Pedal2:1'],
      why: 'Floor pivot in double shear. A slot near the pivot drives the master cylinders at a ~6:1 pedal ratio.' },
    { id: 'pad', n: 2, name: 'Toe pad', spec: 'Bolted on', nodes: ['Pedal Pad:1'],
      why: 'A separate part, so it can be replaced as it wears or moved for driver fit without remaking the pedal.' },
    { id: 'bar', n: 3, name: 'Balance bar', spec: 'Tilton 600-Series', nodes: ['72-250 .375 BALANCE BAR, 10-20-2014:1'],
      why: 'Splits force between front and rear circuits. Its spherical bearing rides in the pedal slot.' },
    { id: 'mc', n: 4, name: 'Twin master cylinders', spec: 'Tilton 75-Series', nodes: ['Master Cyclinder Assembly:1', 'Master Cyclinder Assembly:2'],
      why: 'One for the front brakes and one for the rear, giving two independent circuits.' },
    { id: 'stop', n: 5, name: 'Over-travel stop', spec: 'Machined 4130 steel', nodes: ['Stop Plate:1'],
      why: 'A hard stop that takes the load into the base plate so the master cylinders are never overloaded.' },
    { id: 'bots', n: 6, name: 'BOTS switch', spec: 'Honeywell 2T1-6', nodes: ['2TL1-6:1'],
      why: 'A mechanical double-pole toggle switch tripped directly by the pedal arm.' },
    { id: 'sensor', n: 7, name: 'Line-pressure sensor', spec: 'Texense FPS-V2', nodes: ['mockup presure sensor:1'],
      why: 'Measures brake pressure for the BSPD.' },
    { id: 'plate', name: 'Mounting plate', spec: 'Base plate with pivot mounts and master cylinder plate', nodes: ['Mounting Plate:1'],
      why: 'Every other part bolts to it. The over-travel stop puts its load into this plate.' },
    { id: 'bracket', name: 'BOTS switch bracket', spec: 'Holds the switch in the pedal’s path', nodes: ['switch holder:1'] },
    { id: 'hardware', name: 'Hardware', spec: '30 bolts, screws and lock nuts', prefixes: FASTENERS, pickSingle: true, nodeLabel: fastenerLabel },
  ],

  balloons: [
    { part: 'arm', node: 'Pedal2:1', at: [-97.2, -14.0, 32.1] },
    { part: 'pad', node: 'Pedal Pad:1', at: [-90.3, -21.5, 112.0] },
    { part: 'bar', node: '72-803:1', at: [-101.5, 12.0, 12.5] },
    { part: 'mc', node: 'Master Cyclinder Assembly:1', at: [44.3, 0.6, 24.4] },
    { part: 'stop', node: 'Stop Plate:1', at: [-24.9, -28.4, 34.9] },
    { part: 'bots', node: 'TL10045:1', at: [-52.0, -30.6, 32.6] },
    { part: 'sensor', node: 'mockup presure sensor:1', at: [46.2, 56.1, 11.1] },
  ],

  // Exploded view: offsets in millimetres, applied with the pedal at rest
  explode: [
    { nodes: ['Pedal Assembly:1'], offset: [-75, 0, 25] },
    { nodes: ['Pedal Pad:1'], offset: [-27, 0, 6.5] },
    { nodes: [M4_SCREW + 1, M4_SCREW + 2, M4_SCREW + 3], offset: [-143, 0, 41] },
    { nodes: [M4_NUT + 1, M4_NUT + 2, M4_NUT + 3], offset: [-54, 0, 20] },
    { nodes: ['Broached Hexagon Socket Head Cap Screw ASME B18.3.1M - M8x1.25 x 90 Steel Grade 2 Plain:1'], offset: [0, 115, 0] },
    { nodes: ['Nylon Insert Locknut ASME B18.16.6 - 3/8-16 NE Steel Grade 2H Plain:1'], offset: [0, -40, 0] },
    { nodes: ['72-250 .375 BALANCE BAR, 10-20-2014:1'], offset: [0, 0, 70] },
    { nodes: ['Piston:2'], offset: [-30, 0, 0] },
    { nodes: ['Tilton master cylinder 75 series .625 to .75 no reservoir:1'], offset: [75, 0, 0] },
    { prefixes: ['Hex Head Bolt JIS B 1180 - M8x35'], offset: [-45, 0, 0] },
    { prefixes: ['Nylon Insert Locknut ASME B18.16.6 - 5/16-18'], offset: [35, 0, 0] },
    { nodes: ['Stop Plate:1'], offset: [0, 0, 55] },
    { prefixes: ['Broached Hexagon Socket Head Cap Screw ASME B18.3.1M - M6x1 x 40'], offset: [-50, 0, 55] },
    { prefixes: ['Nylon Insert Locknut ASME B18.16.6 - 12-24 NTM'], offset: [30, 0, 0] },
    { nodes: ['switch holder:1'], offset: [0, 70, 0] },
    { nodes: ['2TL1-6:1'], offset: [0, 70, 45] },
    { prefixes: ['Hexagon Socket Head Cap Screw DIN 912 - M3'], offset: [0, 70, 70] },
    { prefixes: ['Nylon Insert Locknut ASME B18.16.6 - 4-40 NTM'], offset: [0, 70, -20] },
    { nodes: ['mockup presure sensor:1'], offset: [0, 40, 0] },
  ],

  kinematics: {
    setup(api) {
      const all = (names) => names.flatMap((n) => api.findAll(n));
      nodes = { pedal: all(PEDAL_NODES), bar: all(BAR_NODES), lever: all(LEVER_NODES) };
      const T = api.THREE;
      tmp.a = new T.Matrix4(); tmp.b = new T.Matrix4(); tmp.c = new T.Matrix4();
      tmp.pedal = new T.Matrix4(); tmp.bar = new T.Matrix4(); tmp.lever = new T.Matrix4();
      tmp.x0 = barX(0);
    },
    update(travel, api) {
      const T = api.THREE;
      const model = REST + travel;
      const rotAbout = (out, cx, cz, d) => {
        tmp.a.makeTranslation(cx, 0, cz);
        tmp.b.makeRotationY(T.MathUtils.degToRad(d));
        tmp.c.makeTranslation(-cx, 0, -cz);
        return out.copy(tmp.a).multiply(tmp.b).multiply(tmp.c);
      };
      rotAbout(tmp.pedal, PIVOT.x, PIVOT.z, model);
      tmp.bar.makeTranslation(barX(model) - tmp.x0, 0, 0);
      rotAbout(tmp.lever, LEVER_PIN.x, LEVER_PIN.z, leverAngle(model));
      nodes.pedal.forEach((n) => api.setKin(n, tmp.pedal));
      nodes.bar.forEach((n) => api.setKin(n, tmp.bar));
      nodes.lever.forEach((n) => api.setKin(n, tmp.lever));
    },
  },

  motion: {
    max: 30.3,
    positions: POSITIONS,
    describe(t) {
      const stroke = (barX(REST + t) - barX(REST)) / MC_STROKE;
      const at = (v) => Math.abs(t - v) < 0.06;
      let state, short;
      if (t < 0.06) { state = '<strong>Rest.</strong> The pedal rests at 76.8°.'; short = 'Rest'; }
      else if (at(15)) { state = '<strong>Lock-up.</strong> About 15° of travel from rest, where the calculated line pressure locks the brakes.'; short = 'Lock-up'; }
      else if (t < 15) { state = '<strong>Braking.</strong> The balance bar’s bearing slides along the slot in the pedal and pushes both master cylinders.'; short = 'Braking'; }
      else if (t < 21 - 0.06) { state = '<strong>Past lock-up.</strong> Normal braking never goes this far. Travel past lock-up means a hydraulic circuit has failed.'; short = 'Past lock-up'; }
      else if (t < 30.3 - 0.06) { state = '<strong>BOTS trip.</strong> Past normal braking. The pedal arm trips the BOTS and opens the shutdown circuit.'; short = 'BOTS tripped'; }
      else { state = '<strong>Hard stop.</strong> The pedal hits the mechanical stop, which takes 2,000+ N into the base plate so the load never reaches the master cylinders.'; short = 'Hard stop'; }
      return { angle: `${(REST_ANGLE - t).toFixed(1)}°`, stroke, bots: t >= 21 - 0.06, state, short };
    },
  },
};
