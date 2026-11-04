/**
 * The cases of docs/viewer-examples.md, as links on the start page. `expected` is the category the
 * docs list (checked against `processBikelanes`); the viewer shows it next to the link.
 */
export type Example = {
  label: string
  tags: string
  expected: string
}

export type ExampleGroup = {
  id: string
  label: string
  examples: Example[]
}

export const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    id: 'foot-and-cycle',
    label: 'Geh- und Radwege: gemeinsam, getrennt, zwei Linien',
    examples: [
      {
        label: 'Gemeinsamer Geh- und Radweg, beschildert (DE:240)',
        tags: 'highway=path;bicycle=designated;foot=designated;segregated=no;traffic_sign=DE:240',
        expected: 'footAndCyclewayShared_adjoiningOrIsolated',
      },
      {
        label: 'Gemeinsamer Geh- und Radweg, unbeschildert',
        tags: 'highway=path;bicycle=designated;foot=designated;segregated=no',
        expected: 'footAndCyclewayShared_adjoiningOrIsolated',
      },
      {
        label: 'Getrennter Geh- und Radweg, beschildert (DE:241)',
        tags: 'highway=path;bicycle=designated;foot=designated;segregated=yes;traffic_sign=DE:241',
        expected: 'footAndCyclewaySegregated_adjoiningOrIsolated',
      },
      {
        label: 'Getrennter Geh- und Radweg, unbeschildert, an der Straße',
        tags: 'highway=path;bicycle=designated;foot=designated;segregated=yes;is_sidepath=yes',
        expected: 'footAndCyclewaySegregated_adjoining',
      },
      {
        label: 'Zwei Linien: Radweg mit Gehweg rechts daneben',
        tags: 'highway=cycleway;is_sidepath=yes;bicycle=designated;traffic_mode:right=foot',
        expected: 'footAndCyclewaySegregated_adjoining',
      },
      {
        label: 'Gehweg, Rad frei',
        tags: 'highway=footway;footway=sidewalk;bicycle=yes',
        expected: 'footwayBicycleYes_adjoining',
      },
    ],
  },
  {
    id: 'separate-way',
    label: 'Eigene Linie: Radweg',
    examples: [
      {
        label: 'Nur highway=cycleway (die Falle)',
        tags: 'highway=cycleway',
        expected: 'needsClarification',
      },
      {
        label: 'Radweg, beide Verkehrsarten designated, sonst nichts',
        tags: 'highway=cycleway;bicycle=designated;foot=designated',
        expected: 'needsClarification',
      },
      {
        label: 'Radweg ohne Schild',
        tags: 'highway=cycleway;traffic_sign=none',
        expected: 'cycleway_adjoiningOrIsolated',
      },
      {
        label: 'Radweg an der Straße',
        tags: 'highway=cycleway;is_sidepath=yes',
        expected: 'cycleway_adjoining',
      },
      {
        label: 'Geschützter Radfahrstreifen als eigene Linie (Poller)',
        tags: 'highway=cycleway;is_sidepath=yes;separation:left=bollard',
        expected: 'cyclewayOnHighwayProtected',
      },
      {
        label: 'Schutz zählt nicht mit segregated=yes',
        tags: 'highway=cycleway;is_sidepath=yes;separation:left=bollard;segregated=yes',
        expected: 'cycleway_adjoining',
      },
    ],
  },
  {
    id: 'road',
    label: 'Tags an der Straße (ein Ergebnis je Seite)',
    examples: [
      {
        label: 'Geschützter Radfahrstreifen (Leitboys)',
        tags: 'highway=residential;cycleway:right=lane;cycleway:right:lane=exclusive;cycleway:right:separation:left=flex_post',
        expected: 'cyclewayOnHighwayProtected',
      },
      {
        label: 'Bordsteinradweg ist nicht „geschützt“',
        tags: 'highway=residential;cycleway:right=track;cycleway:right:separation:left=kerb',
        expected: 'cycleway_adjoining',
      },
      {
        label: 'Radweg mit segregated=yes an der Straße',
        tags: 'highway=residential;cycleway:right=track;cycleway:right:segregated=yes',
        expected: 'footAndCyclewaySegregated_adjoining',
      },
      {
        label: 'Schutzstreifen auf beiden Seiten',
        tags: 'highway=residential;cycleway:both=lane;cycleway:both:lane=advisory',
        expected: 'cyclewayOnHighway_advisory',
      },
      {
        label: 'Gehweg mit Rad frei',
        tags: 'highway=residential;sidewalk:right=yes;sidewalk:right:bicycle=yes',
        expected: 'footwayBicycleYes_adjoining',
      },
      {
        label: 'Fahrradstraße',
        tags: 'highway=residential;bicycle_road=yes',
        expected: 'bicycleRoad',
      },
      {
        label: 'Fahrradstraße, Anlieger frei',
        tags: 'highway=residential;bicycle_road=yes;vehicle=destination',
        expected: 'bicycleRoad_vehicleDestination',
      },
    ],
  },
]
