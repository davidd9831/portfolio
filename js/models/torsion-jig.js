// Torsional rigidity test jig for the AME26 chassis (Texas A&M FSAE EV, chassis subteam)
// Model: assets/models/torsion-jig.glb, built from "AME 26 TR Jig Assembly.STEP" (SolidWorks 2026, Oct 17).
// Only the jig parts are included. The team's car parts are left out, and the chassis frame is replaced
// by a coarse, blurred outline (voxelised, smoothed and decimated) that is drawn see-through.
// Coordinates: metres, Y up. Origin: front pivot apex (x), top of the platform (y), front beam center (z).
// The front weight posts sit 1.153 m either side of the pivot.

export default {
  title: 'AME26 torsion jig',
  models: [{ label: 'Assembly', url: new URL('../../assets/models/torsion-jig.glb', import.meta.url).href }],
  exposure: 1.0,
  edges: true,
  edgeAngle: 30,
  // see-through reference geometry: never picked, no edges, drawn after the solid parts
  ghosts: ['Chassis outline'],
  fitMargin: 0.86, // the wide, flat jig leaves the bounding box corners well outside its silhouette
  orbit: { theta: 138, phi: 58 },
  views: [
    { label: '3/4 view', theta: 138, phi: 58 },
    { label: 'Front (looking along the car)', theta: 180, phi: 86 },
    { label: 'Side', theta: 90, phi: 86 },
    { label: 'Top', theta: 180, phi: 0.01 },
  ],

  parts: [
    { id: 'rear', n: 1, name: 'Rear fixture', spec: 'Welded steel, anchored into concrete', nodes: ['Rear fixture'],
      why: 'Holds the back of the chassis still. Its triangular mock uprights stand where the rear wheel uprights would be.' },
    { id: 'rearMounts', n: 2, name: 'Rear suspension mounts', spec: 'Water-jetted face plates and clevis tabs', nodes: ['Rear mock upright faces'],
      why: 'The suspension links connect here instead of to the wheel uprights. With the suspension made rigid, load goes straight into the chassis.' },
    { id: 'front', n: 3, name: 'Front lever beam', spec: 'Welded steel beam, V-shaped center pivot, weight posts at both ends', nodes: ['Front lever beam'],
      why: 'Rests on a pivot at the car’s centerline, so the front of the chassis can only roll. A weight hung on a post 1.15 m from the pivot applies a known torque.' },
    { id: 'frontMounts', n: 4, name: 'Front suspension mounts', spec: 'Water-jetted face plates and clevis tabs', nodes: ['Front mock upright faces'],
      why: 'Same job as the rear mounts: the front suspension links connect to the mock uprights on the lever beam.' },
    { id: 'pivot', n: 5, name: 'Pivot plate', spec: 'Plate under the center pivot', nodes: ['Pivot plate'],
      why: 'The lever beam’s V-shaped pivot sits on this plate.' },
  ],

  balloons: [
    { part: 'rear', node: 'Rear fixture', at: [-0.30, 0.02, 1.53] },
    { part: 'rearMounts', node: 'Rear mock upright faces', at: [0.58, 0.20, 1.544] },
    { part: 'front', node: 'Front lever beam', at: [-1.05, 0.03, 0.0] },
    { part: 'frontMounts', node: 'Front mock upright faces', at: [0.60, 0.20, 0.0] },
    { part: 'pivot', node: 'Pivot plate', at: [0.2, 0.006, -0.1] },
  ],
};
