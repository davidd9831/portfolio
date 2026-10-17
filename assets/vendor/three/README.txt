three.js r169 (MIT licence, see LICENSE), copied from the npm package three@0.169.0
so the site doesn't depend on a CDN.

Only change: in the files under addons/, the line `} from 'three';` was changed to a
relative path (`} from '../../three.module.min.js';`) so the browser can load them
without an import map.
