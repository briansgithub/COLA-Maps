/** Minimal GeoJSON types used by coeff-map (avoids hard dep if @types/geojson absent). */
declare namespace GeoJSON {
  interface GeoJsonObject {
    type: string;
    bbox?: number[];
  }
  interface FeatureCollection<
    G extends Geometry | null = Geometry | null,
    P = GeoJsonProperties,
  > extends GeoJsonObject {
    type: 'FeatureCollection';
    features: Array<Feature<G, P>>;
  }
  interface Feature<G extends Geometry | null = Geometry | null, P = GeoJsonProperties>
    extends GeoJsonObject {
    type: 'Feature';
    id?: string | number;
    geometry: G;
    properties: P;
  }
  type GeoJsonProperties = { [name: string]: unknown } | null;
  type Geometry =
    | Point
    | MultiPoint
    | LineString
    | MultiLineString
    | Polygon
    | MultiPolygon
    | GeometryCollection;
  interface Point {
    type: 'Point';
    coordinates: number[];
  }
  interface MultiPoint {
    type: 'MultiPoint';
    coordinates: number[][];
  }
  interface LineString {
    type: 'LineString';
    coordinates: number[][];
  }
  interface MultiLineString {
    type: 'MultiLineString';
    coordinates: number[][][];
  }
  interface Polygon {
    type: 'Polygon';
    coordinates: number[][][];
  }
  interface MultiPolygon {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  }
  interface GeometryCollection {
    type: 'GeometryCollection';
    geometries: Geometry[];
  }
}
