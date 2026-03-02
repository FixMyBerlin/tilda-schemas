# Bikelanes – Data Schema Documentation | March 2026

> **Layer:** `bikelanes`  
> **Geometry:** LineString  
> **Source:** OpenStreetMap ways processed via `osm2pgsql` (Flex Output)  
> **Processing file:** `processing/topics/roads_bikelanes/roads_bikelanes.lua`

Each feature in this layer represents a single piece of cycling infrastructure — either derived from a standalone OSM way (e.g. `highway=cycleway`) or projected to the side of a road from centre-line tags (e.g. `cycleway:right=track`).

---

## Key Overview

All properties available on a feature at a glance:

**Identity & Classification:** `category`, `side`, `prefix`, `_parent_highway`, `_is_sidepath`, `road`, `name`

**Geometry:** `length`, `offset`

**Direction of Travel:** `oneway`, `_implicitOneWayConfidence`

**Lifecycle & Status:** `lifecycle`

**Physical Dimensions:** `width`, `width_source`, `width_effective`

**Surface & Smoothness:** `surface`, `surface_source`, `surface_confidence`, `surface_color`, `smoothness`, `smoothness_source`, `smoothness_confidence`

**Separation & Marking:** `separation_left`, `separation_right`, `buffer_left`, `buffer_right`, `marking_left`, `marking_right`

**Traffic Mode:** `traffic_mode_left`, `traffic_mode_right`

**Traffic Signs:** `traffic_sign`, `traffic_sign:forward`, `traffic_sign:backward`

**Mapillary:** `mapillary`, `mapillary_forward`, `mapillary_backward`, `mapillary_traffic_sign`, `mapillary_coverage`

**Other:** `bridge`, `tunnel`, `description`, `operator_type`, `informal`, `covered`, `todos`

---

## Database Columns

| Column    | Type        | Description |
|-----------|-------------|-------------|
| `id`      | `text`      | Unique feature ID. For projected geometries: `<osm_id>/<prefix>/<side>` (e.g. `w123456/cycleway/right`). For standalone ways: `w<osm_id>`. |
| `tags`    | `jsonb`     | All feature properties (see below). |
| `meta`    | `jsonb`     | OSM metadata (timestamp, version, changeset, user). |
| `geom`    | `linestring`| Geometry (WGS 84). Projected geometries are offset from the road centre line. |
| `minzoom` | `integer`   | Minimum zoom level for tile inclusion (derived from `BikeLaneGeneralization`). |

---

## Properties (`tags`)

### Identity & Classification

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `category` | `string` | See [Category Values](#category-values) | The infrastructure category. Central property used for styling and analysis. |
| `side` | `string` | `self`, `left`, `right` | Relation of this feature to the parent road. `self` = a standalone way; `left`/`right` = projected from a centre-line tag. (exposed as `prefix` on the object, `_side` is internal) |
| `prefix` | `string` | `cycleway`, `sidewalk` | The OSM tag prefix used to derive this feature (e.g. `cycleway:right:…` → `cycleway`). |
| `_parent_highway` | `string` | OSM highway values (e.g. `primary`, `residential`) | Highway type of the parent road for projected geometries. `null` for standalone ways. |
| `_is_sidepath` | `boolean` | `true`, `null` | Whether this way is identified (via CSV pseudo-tag data) as a sidepath running alongside a road. |
| `road` | `string` | Road classification values | Classification of the parent/associated road (from `RoadClassification`). |
| `name` | `string` | free text | Name (or `ref` or `is_sidepath:of:name`) of the associated road. |

---

### Geometry

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `length` | `float` | metres | Length of the way in metres (projected in EPSG:5243). |
| `offset` | `float` | metres, positive / negative | Lateral offset from the road centre line. Positive = right side, negative = left side. Only set for `side = left/right`. |

---

### Direction of Travel

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `oneway` | `string` | `yes`, `no`, `car_not_bike`, `assumed_no`, `implicit_yes` | Direction of permitted bicycle travel. See notes below. |
| `_implicitOneWayConfidence` | `string` | `high`, `medium`, `low`, `not_applicable` | Confidence that the derived `oneway` value is correct. Used to trigger the `missing_oneway` todo. *(internal, exposed in tags)* |

**`oneway` value notes:**

| Value | Meaning |
|-------|---------|
| `yes` | Explicitly one-way for cyclists (`oneway:bicycle=yes` or `oneway=yes` without exception). |
| `no` | Two-way for cyclists (`oneway:bicycle=no` with no general oneway, or `oneway=no`). |
| `car_not_bike` | General `oneway=yes` but with `oneway:bicycle=no` exception — cars one-way, bikes both directions. |
| `assumed_no` | No oneway tag present; two-way assumed (default for tracks, paths, etc.). |
| `implicit_yes` | No oneway tag, but category implies one direction (e.g. a lane next to a road). |

---

### Lifecycle & Status

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `lifecycle` | `string` | `temporary`, other lifecycle values | Indicates constructions, planned infrastructure, or temporary status. Derived from `lifecycle=*` on the OSM object, the `temporary=yes` tag, or lifecycle prefixes like `construction:highway=cycleway`. |

---

### Physical Dimensions

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `width` | `float` | metres | Carriageway width in metres. Parsed from `width=*` (supports `m`, `ft`, decimal values). |
| `width_source` | `string` | free text | Source of the width value (`source:width=*`). |
| `width_effective` | `float` | metres | Usable/effective width (`width:effective=*`), may differ from `width` if obstacles reduce it. |

---

### Surface & Smoothness

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `surface` | `string` | See [Surface Values](#surface-values) | Pavement type. Sanitised/normalised from OSM `surface=*`. May be inherited from the parent road for categories with `copySurfaceSmoothnessFromParent = true`. |
| `surface_source` | `string` | `tag`, `tag_normalized`, `parent_highway_tag`, `parent_highway_tag_normalized` | How the surface value was obtained. |
| `surface_confidence` | `string` | `high` | Confidence in the surface value. Currently always `high` when present. |
| `surface_color` | `string` | `red`, `green`, `red;green`, `no` | Colour marking on the cycle path surface (from `surface:colour=*` or `surface:color=*`). |
| `smoothness` | `string` | See [Smoothness Values](#smoothness-values) | Ride quality. Derived from `smoothness=*` tag or inferred from `surface=*`. May be inherited from parent road. |
| `smoothness_source` | `string` | `tag`, `tag_normalized`, `derived_from_surface`, `parent_highway_tag`, `parent_highway_tag_normalized`, `parent_highway_derived_from_surface` | How the smoothness value was obtained. |
| `smoothness_confidence` | `string` | `high`, `medium` | Confidence in the smoothness value. |

---

### Separation & Marking

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `separation_left` | `string` | See [Separation Values](#separation-values) | Physical separation on the **left** side of this cycle track (from `separation:left=*` / `separation:both=*` / `separation=*`). "Left" is the direction of travel. |
| `separation_right` | `string` | See [Separation Values](#separation-values) | Physical separation on the **right** side (from `separation:right=*` / `separation:both=*`). |
| `buffer_left` | `float` | metres | Buffer/clearance on the **left** side (`buffer:left=*`). |
| `buffer_right` | `float` | metres | Buffer/clearance on the **right** side (`buffer:right=*`). |
| `marking_left` | `string` | See [Marking Values](#marking-values) | Road marking type on the **left** edge of this lane. |
| `marking_right` | `string` | See [Marking Values](#marking-values) | Road marking type on the **right** edge of this lane. |

---

### Traffic Mode (Adjacent Uses)

These properties describe what type of traffic uses the space immediately adjacent to this cycle infrastructure.

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `traffic_mode_left` | `string` | `no`, `motor_vehicle`, `parking`, `psv`, `bicycle`, `foot` | Traffic mode to the **left** of this lane (from `traffic_mode:left=*`). May be inferred from `parking:left=*` for protected lane categories. |
| `traffic_mode_right` | `string` | `no`, `motor_vehicle`, `parking`, `psv`, `bicycle`, `foot` | Traffic mode to the **right** of this lane (from `traffic_mode:right=*`). |

---

### Traffic Signs

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `traffic_sign` | `string` | e.g. `DE:237`, `DE:240`, `DE:244.1` | Primary traffic sign(s) applicable to both directions (from `traffic_sign=*` or `traffic_sign:both=*`). Sanitised. |
| `traffic_sign:forward` | `string` | e.g. `DE:237` | Traffic sign(s) applicable in the forward direction (`traffic_sign:forward=*`). |
| `traffic_sign:backward` | `string` | e.g. `DE:237` | Traffic sign(s) applicable in the backward direction (`traffic_sign:backward=*`). |

---

### Mapillary / Street-Level Imagery

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `mapillary` | `string` | Mapillary sequence key | Mapillary imagery reference(s) for both directions (from `mapillary=*` or `source:mapillary=*`). Multiple values are semicolon-separated. |
| `mapillary_forward` | `string` | Mapillary sequence key | Imagery for the forward direction. |
| `mapillary_backward` | `string` | Mapillary sequence key | Imagery for the backward direction. |
| `mapillary_traffic_sign` | `string` | Mapillary sequence key | Imagery specifically documenting the traffic sign. |
| `mapillary_coverage` | `boolean` | `true`, `null` | Whether this section is covered by a Mapillary street-level sequence (derived from external CSV pseudo-tag data). Used to prioritise todos. |

---

### Other

| Property | Type | Values | Description |
|----------|------|--------|-------------|
| `bridge` | `string` | `yes` | The way is on a bridge. |
| `tunnel` | `string` | `yes` | The way goes through a tunnel. |
| `description` | `string` | free text | Description or note (from `description=*` or `note=*`). May include TILDA-specific hints (prefix `TILDA-Hinweis:`). Multiple values are semicolon-separated. |
| `operator_type` | `string` | `public`, `private` | Operator type derived from `operator:type=*` or `operator=*`. |
| `informal` | `string` | `yes` | Marks the way as informal/unofficial. |
| `covered` | `string` | `covered`, `partial`, `indoor` | The way is covered or indoors. |
| `todos` | `string` | Markdown formatted list | Human-readable list of data quality issues (todos) for use in the inspector. |

---

## Category Values

The `category` property is the central classification of every bikelane feature. Each category maps to a specific type of cycling infrastructure or a data quality state.

### No Infrastructure

| Category | German term | Description |
|----------|-------------|-------------|
| `data_no` | — | Explicit absence of cycling infrastructure (`cycleway=no` / `cycleway=none`). |
| `separate_geometry` | — | The cycling infrastructure is mapped as a separate OSM geometry (`cycleway=separate`). |
| `not_expected` | — | No cycling infrastructure expected on this side (implicit for the left side of oneways without a `oneway:bicycle=no` exception). |

### Bicycle Roads

| Category | German term | Description |
|----------|-------------|-------------|
| `bicycleRoad` | Fahrradstraße | Bicycle road (`bicycle_road=yes` or `traffic_sign=DE:244`). |
| `bicycleRoad_vehicleDestination` | Fahrradstraße (Anlieger/Kfz frei) | Bicycle road with permitted access for motor vehicles (`destination`), indicated by e.g. `traffic_sign=DE:244.1,1020-30`. |

### Standalone Cycling Infrastructure

| Category | German term | Description |
|----------|-------------|-------------|
| `cycleway_adjoining` | Radweg (anliegend) | Dedicated separated cycleway directly adjacent to a road (`is_sidepath=yes`). |
| `cycleway_isolated` | Radweg (frei geführt) | Dedicated separated cycleway not adjacent to a road (`is_sidepath=no`). |
| `cycleway_adjoiningOrIsolated` | Radweg (unbekannt) | Dedicated separated cycleway; unclear whether adjoining or isolated. Triggers a todo. |
| `cyclewayOnHighwayProtected` | Geschützter Radfahrstreifen (PBL) | Protected bike lane (PBL): a cycleway on the road surface separated from motorised traffic by physical barriers (bollards, parked cars, etc.). |
| `cyclewayLink` | Netzverbindung | `cycleway=link`: a virtual connection used for routing, not a physical infrastructure feature in the traditional sense. |
| `crossing` | Querung | A bicycle-relevant crossing (recognised via `cycleway=crossing`, `path=crossing`, etc.) with a maximum length of 100 m. |

### On-Road Bike Lanes

| Category | German term | Description |
|----------|-------------|-------------|
| `cyclewayOnHighway_exclusive` | Radfahrstreifen | Exclusive bike lane on the road, separated by a solid line (`cycleway:lane=exclusive`). |
| `cyclewayOnHighway_advisory` | Schutzstreifen | Advisory/soft bike lane on the road, with a dashed line that vehicles may cross (`cycleway:lane=advisory`). |
| `cyclewayOnHighway_advisoryOrExclusive` | Radfahrstreifen/Schutzstreifen | Type of on-road bike lane unclear (no `cycleway:lane` sub-tag). Triggers a todo. |
| `cyclewayOnHighwayBetweenLanes` | Radweg in Mittellage (RiM) | Bike lane running between motorised traffic lanes, identifiable by `cycleway:lanes` / `bicycle:lanes` schemas. |
| `sharedMotorVehicleLane` | Gemeinsamer Fahrstreifen | Shared lane with motor vehicles (`cycleway=shared_lane`). |
| `sharedBusLaneBusWithBike` | Bussonderfahrstreifen mit Fahrrad frei | Bus lane with explicit bicycle access (`cycleway=share_busway`, or `traffic_sign=DE:245,1022-10`). |
| `sharedBusLaneBikeWithBus` | Radfahrstreifen mit Freigabe Busverkehr | Bike lane with explicit bus access (`traffic_sign=DE:237,1024-14` or `lane=share_busway`). |

### Shared Foot & Cycle Paths

| Category | German term | Description |
|----------|-------------|-------------|
| `footAndCyclewayShared_adjoining` | Gemeinsamer Geh- und Radweg (anliegend) | Shared, unsegregated foot and cycle path next to a road (`traffic_sign=DE:240` or `segregated=no + bicycle=designated + foot=designated`). |
| `footAndCyclewayShared_isolated` | Gemeinsamer Geh- und Radweg (frei geführt) | Shared, unsegregated foot and cycle path not next to a road. |
| `footAndCyclewayShared_adjoiningOrIsolated` | Gemeinsamer Geh- und Radweg (unbekannt) | Shared path; unclear whether adjoining or isolated. |
| `footAndCyclewaySegregated_adjoining` | Getrennter Geh- und Radweg (anliegend) | Segregated foot and cycle path next to a road (`traffic_sign=DE:241` or `segregated=yes`). |
| `footAndCyclewaySegregated_isolated` | Getrennter Geh- und Radweg (frei geführt) | Segregated foot and cycle path not next to a road. |
| `footAndCyclewaySegregated_adjoiningOrIsolated` | Getrennter Geh- und Radweg (unbekannt) | Segregated path; unclear whether adjoining or isolated. |

### Footways with Bicycle Access

| Category | German term | Description |
|----------|-------------|-------------|
| `footwayBicycleYes_adjoining` | Gehweg, Fahrrad frei (anliegend) | Footway/sidewalk adjacent to a road with explicit bicycle allowance (`bicycle=yes` or `traffic_sign=DE:239,1022-10`). |
| `footwayBicycleYes_isolated` | Gehweg, Fahrrad frei (frei geführt) | Footway not adjacent to a road with bicycle allowance. |
| `footwayBicycleYes_adjoiningOrIsolated` | Gehweg, Fahrrad frei (unbekannt) | Footway with bicycle allowance; unclear adjoining/isolated status. |

### Pedestrian Areas

| Category | German term | Description |
|----------|-------------|-------------|
| `pedestrianAreaBicycleYes` | Fußgängerzone, Fahrrad frei | Pedestrian area (`highway=pedestrian`) with explicit bicycle access (`bicycle=yes` or `bicycle=designated`). Only linear ways, not area polygons. |

### Data Quality

| Category | German term | Description |
|----------|-------------|-------------|
| `needsClarification` | Unklare Infrastruktur | Cycling infrastructure that cannot be categorised due to missing or ambiguous tagging. Check the `todos` property for improvement hints. |

---

## Surface Values

The `surface` property is sanitised. The following values represent all accepted output values after normalisation:

| Value | Description |
|-------|-------------|
| `asphalt` | Asphalt |
| `paved` | Paved (unspecific) |
| `unpaved` | Unpaved (unspecific) |
| `concrete` | Concrete |
| `concrete:plates` | Concrete slabs/plates |
| `concrete:lanes` | Concrete lanes |
| `paving_stones` | Paving stones (Pflastersteine) |
| `paving_stones:lanes` | Paving stone lanes |
| `sett` | Sett (exact size unknown) |
| `mosaic_sett` | Small mosaic sett (≤ 8 cm) |
| `small_sett` | Small sett (≤ 13 cm) |
| `large_sett` | Large sett / cobblestone (> 13 cm or `cobblestone=*`) |
| `bricks` | Brick pavement |
| `stone` | Stone (generic: `rock`, `stone:plates`) |
| `ground` | Ground / earth / dirt (all normalised to `ground`) |
| `grass` | Grass |
| `sand` | Sand |
| `compacted` | Compacted gravel |
| `fine_gravel` | Fine gravel |
| `gravel` | Gravel |
| `pebblestone` | Pebblestone |
| `wood` | Wood / boardwalk |
| `woodchips` | Woodchips |
| `metal` | Metal |
| `metal_grid` | Metal grid |
| `plastic` | Plastic |
| `rubber` | Rubber / tartan |
| `grass_paver` | Grass paver |

---

## Smoothness Values

The `smoothness` property represents ride quality, normalised to a simplified set of values:

| Value | Meaning | Rolling resistance |
|-------|---------|-------------------|
| `excellent` | Very smooth (also `very_good` → normalised) | Very low |
| `good` | Smooth | Low |
| `intermediate` | Some roughness | Medium |
| `bad` | Rough | High |
| `very_bad` | Very rough (also `horrible`, `very_horrible`, `impassable` → normalised) | Very high |

---

## Separation Values

Used by `separation_left` and `separation_right`.

| Value | Description |
|-------|-------------|
| `no` | No separation |
| `bollard` | Bollard |
| `flex_post` | Flexible delineator post |
| `vertical_panel` | Vertical panel |
| `studs` | Raised pavement studs/tactile paving |
| `bump` | Raised bump / humps |
| `planter` | Planter / flower box |
| `kerb` | Kerb |
| `fence` | Fence |
| `jersey_barrier` | Jersey barrier / concrete block |
| `guard_rail` | Guard rail |
| `structure` | Physical structure (generic) |
| `ditch` | Ditch |
| `greenery` | Green strip / vegetation |
| `hedge` | Hedge |
| `tree_row` | Row of trees |
| `cone` | Traffic cone (typically temporary) |
| `kerb;parking_lane` | Kerb with adjacent parking lane |
| `kerb;bollard` | Kerb with bollard |
| `yes` | Unspecified physical separation |

---

## Marking Values

Used by `marking_left` and `marking_right`.

| Value | German term | Description |
|-------|-------------|-------------|
| `solid_line` | Durchgezogene Linie | Solid line (no crossing permitted) |
| `dashed_line` | Gestrichelte Linie | Dashed line |
| `double_solid_line` | Doppelte Linie | Double solid line |
| `barred_area` | Sperrfläche | Hatched/barred area |
| `pictogram` | Piktogramm | Bicycle pictogram on road surface |
| `surface` | Farbige Oberfläche | Coloured surface marking |

---

## Traffic Mode Values

Used by `traffic_mode_left` and `traffic_mode_right`.

| Value | Description |
|-------|-------------|
| `no` | No adjacent traffic / empty space |
| `motor_vehicle` | Motorised traffic |
| `parking` | Parked vehicles |
| `psv` | Public service vehicles (bus, tram) |
| `bicycle` | Bicycle traffic |
| `foot` | Pedestrian traffic |

---

## Todos

The `todos` field contains a Markdown-formatted list of data quality issues. The following todo IDs can appear (used in the separate `todos_lines` table and in the `todos` property):

| Todo ID | Visible in inspector | Description |
|---------|---------------------|-------------|
| `needs_clarification` | ✅ | Tagging insufficient to determine the infrastructure type. |
| `crossing_too_long` | ✅ | Crossing longer than 100 m — unclear geometry. |
| `adjoining_or_isolated` | ✅ | For `cycleway_adjoiningOrIsolated`: `is_sidepath=yes/no` missing. |
| `advisory_or_exclusive` | ✅ | `cycleway:*:lane=advisory` or `exclusive` missing. |
| `needs_clarification_track` | ✅ | `cycleway=track` without sufficient sub-tagging (`segregated`, `traffic_sign`). |
| `mixed_cycleway_both` | ✅ | Mixed use of `cycleway=*` / `cycleway:both=*` together with `cycleway:SIDE=*`. |
| `unexpected_highway_path` | ✅ | `highway=path + bicycle=designated` should likely be `highway=cycleway`. |
| `unexpected_bicycle_access_on_footway` | ✅ | `highway=footway + bicycle=designated` — unexpected combination. |
| `missing_traffic_sign_vehicle_destination` | — | Bicycle road with `vehicle=destination` but no corresponding `traffic_sign`. |
| `missing_traffic_sign_244` | — | Bicycle road without `traffic_sign=DE:244.1`. |
| `missing_access_tag_bicycle_road` | ✅ | Bicycle road missing `bicycle=designated`. |
| `missing_traffic_sign` | — | Infrastructure without any `traffic_sign=*` tag. |
| `malformed_traffic_sign` | — | `traffic_sign=*` value differs from its sanitised/normalised form. |
| `missing_access_tag_240` | ✅ | `traffic_sign=DE:240/241` present but `bicycle=designated` and `foot=designated` missing. |
| `missing_segregated` | ✅ | DE:240/241 path without `segregated=yes/no`. |
| `currentness_too_old` | — | No edits for ≥ 10 years. |
| `missing_width` | — | No `width=*` tag. |
| `missing_surface` | — | No `surface=*` tag (or surface not from a direct OSM tag). |
| `missing_oneway` | ✅ | Oneway status unclear (`assumed_no` or `implicit_yes`) for a category with low confidence. |

Mapillary-prioritised variants of most todos also exist (suffix `__mapillary`), which are only written to the todo table and are not shown in the inspector.
