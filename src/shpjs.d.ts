declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  type Ergebnis = FeatureCollection & { fileName?: string };
  type Teile = { shp: Uint8Array; dbf?: Uint8Array; cpg?: Uint8Array; prj?: string };
  export default function getShapefile(base: ArrayBuffer | string | Teile): Promise<Ergebnis | Ergebnis[]>;
}
