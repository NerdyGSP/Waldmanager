declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  type Ergebnis = FeatureCollection & { fileName?: string };
  export default function getShapefile(base: ArrayBuffer | string): Promise<Ergebnis | Ergebnis[]>;
}
