// Turns the docs home's release into a rotation through the newest launches.
// The generator renders every launch as a slide, with the first one shown,
// and the strip beneath as their tabs. This advances them on a timer, holds
// still while the release or the strip is hovered or focused or off screen,
// and lets a tab pick its launch. Readers who ask for reduced motion get the
// tabs without the timer. Without JavaScript, the first launch shows and each
// tab opens its model page.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const ReleaseRotator = ({ interval = 7000 }) => {
  useEffect(() => {
    const release = document.querySelector('.vh-release');
    const strip = document.querySelector('.vh-new');
    const slides = release ? [...release.querySelectorAll('.vh-slide')] : [];
    const tabs = strip ? [...strip.querySelectorAll('.vh-new-item')] : [];
    if (slides.length < 2 || tabs.length !== slides.length) return undefined;

    const reduced = Boolean(window.matchMedia) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = Math.max(0, slides.findIndex(slide => slide.classList.contains('is-active')));
    let timer = null;
    let held = false;
    let visible = true;

    // Re-adding the class restarts the tab's progress bar from empty.
    const restartProgress = () => {
      const tab = tabs[index];
      tab.classList.remove('is-active');
      void tab.offsetWidth;
      tab.classList.add('is-active');
    };

    const activate = next => {
      slides[index].classList.remove('is-active');
      tabs[index].classList.remove('is-active');
      tabs[index].removeAttribute('aria-current');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      tabs[index].classList.add('is-active');
      tabs[index].setAttribute('aria-current', 'true');
      if (strip.scrollWidth > strip.clientWidth) {
        strip.scrollTo({ left: tabs[index].offsetLeft - strip.offsetLeft, behavior: 'smooth' });
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      if (reduced || held || !visible) return;
      timer = setTimeout(() => { activate(index + 1); schedule(); }, interval);
    };

    const hold = () => { held = true; clearTimeout(timer); strip.classList.add('is-paused'); };
    const resume = () => { held = false; strip.classList.remove('is-paused'); restartProgress(); schedule(); };

    const pick = event => {
      event.preventDefault();
      activate(tabs.indexOf(event.currentTarget));
      schedule();
    };

    const hosts = [release, strip];
    hosts.forEach(host => {
      host.addEventListener('mouseenter', hold);
      host.addEventListener('mouseleave', resume);
      host.addEventListener('focusin', hold);
      host.addEventListener('focusout', resume);
    });
    tabs.forEach(tab => tab.addEventListener('click', pick));

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { restartProgress(); schedule(); } else { clearTimeout(timer); }
    });
    if (observer) observer.observe(release);

    if (!reduced) {
      strip.style.setProperty('--vh-rotate', `${interval}ms`);
      strip.classList.add('is-rotating');
    }
    schedule();

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      hosts.forEach(host => {
        host.removeEventListener('mouseenter', hold);
        host.removeEventListener('mouseleave', resume);
        host.removeEventListener('focusin', hold);
        host.removeEventListener('focusout', resume);
      });
      tabs.forEach(tab => tab.removeEventListener('click', pick));
      strip.classList.remove('is-rotating', 'is-paused');
    };
  }, []);

  return null;
};
