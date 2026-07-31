# ukcarimports end-to-end tests

Drives a real browser through the site and asserts what should be true.
Written after a fortnight in which sorting was completely broken and nobody
noticed, because nothing checked it.

## Run

    cd /var/www/ukci-e2e
    npx playwright test                      # staging, desktop + mobile
    npx playwright test --project=mobile     # one viewport
    BASE_URL=https://ukcarimports.ie npx playwright test   # against live

`results.json` is written on every run for the health dashboard to read.

## What is covered

- **smoke** - every linked route returns 200 and renders its heading.
- **nav** - each header link navigates; on mobile the hamburger opens and
  closes, the More dropdown reveals its links, and the hamburger is asserted
  not to overlap any menu item (the regression that made HOW IT WORKS
  untappable on a phone). Also asserts no page scrolls sideways.
- **sort** - price low/high actually orders the results, and the two
  directions disagree. This is the regression that ran undetected.
- **filters.api** - each filter is applied on its own and every returned row
  is checked against it. Colour, seats and body type never appear on a card,
  so a UI-only check could not prove they filtered anything. Also asserts
  filters combine, and that the €15,000 public floor holds.
- **car-detail** - essentials render, the mechanical inspection defaults to
  unticked, external and document links open in a new tab, deposit CTA present.

## Notes

Requests carry no-cache headers: staging has been seen serving stale HTML
after a purge, which would otherwise test yesterday's build.
