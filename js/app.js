import { initCarousel } from './carousel.js';
import { mountChartsIn, unmountChartsIn } from './charts/index.js';

initCarousel({
  onSlideChange: (index, panels) => {
    panels.forEach((p, i) => (Math.abs(i - index) <= 1 ? mountChartsIn(p) : unmountChartsIn(p)));
  }
});
