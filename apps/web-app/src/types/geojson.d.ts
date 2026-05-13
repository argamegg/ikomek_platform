declare module "*.geojson" {
  const value: GeoJSON.FeatureCollection;
  export default value;
}

declare module "*.geojson?raw" {
  const value: string;
  export default value;
}
