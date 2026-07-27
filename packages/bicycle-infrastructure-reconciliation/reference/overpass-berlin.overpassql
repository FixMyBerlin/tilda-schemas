[out:json][timeout:300];
(
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|road|living_street|pedestrian|service|track|path|footway|cycleway|steps)$"](52.3383,13.0883,52.6755,13.7612);
  way["highway"="construction"](52.3383,13.0883,52.6755,13.7612);
);
out tags geom;
